"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/lib/dal";
import { canTeach } from "@/lib/roles";
import { generateJoinCode } from "@/lib/join-code";
import { toCsv } from "@/lib/csv";
import { dateKey, isOnTime } from "@/lib/due";
import { del } from "@vercel/blob";
import { ActivityType } from "@/app/generated/prisma/enums";
import { assignmentInputSchema, canDeleteAssignment, diffAssignmentItems } from "@/lib/assignment-rules";
import { pickExamples, readSplitterSettings, splitterSettingsSchema } from "@/lib/task-splitter-rules";
import { splitTask, type SplitResult } from "@/lib/task-splitter";
import type { SplitterSettings } from "@/lib/task-splitter-options";
import {
  ASSIGNMENT_TX_OPTIONS,
  applyAssignmentEdit,
  assignmentDistributeSelect,
  detachAssignmentCards,
  distributeAssignments,
} from "@/lib/assignments";

export type CourseFormState = { error?: string } | undefined;
/** savedAt เปลี่ยนทุกครั้งที่บันทึกสำเร็จ — dialog ใช้ค่านี้ปิดตัวเอง */
export type AssignmentFormState = { error?: string; savedAt?: number } | undefined;

/** อาจารย์เจ้าของวิชาเท่านั้น — แอดมินก็ดูวิชาของอาจารย์คนอื่นไม่ได้ (เคารพความเป็นส่วนตัวของงานนักศึกษา) */
async function ownCourse(courseId: FormDataEntryValue | string | null) {
  if (typeof courseId !== "string") return null;
  const user = await getCurrentUser();
  if (!canTeach(user.role)) return null;
  return prisma.course.findFirst({
    where: { id: courseId, teacherId: user.id },
    select: { id: true, name: true },
  });
}

/** สุ่มรหัสใหม่จนกว่าจะไม่ชน unique (โอกาสชนต่ำมาก แต่ต้องไม่พังให้ผู้ใช้เห็น) */
async function withUniqueJoinCode<T>(write: (joinCode: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await write(generateJoinCode());
    } catch (error) {
      const duplicate =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!duplicate || attempt >= 4) throw error;
    }
  }
}

export async function createCourseAction(
  _state: CourseFormState,
  formData: FormData
): Promise<CourseFormState> {
  const name = z.string().trim().min(1).max(100).safeParse(formData.get("name"));
  if (!name.success) return { error: "กรอกชื่อรายวิชา (ไม่เกิน 100 ตัวอักษร)" };

  const user = await getCurrentUser();
  if (!canTeach(user.role)) return { error: "เฉพาะอาจารย์เท่านั้นที่สร้างรายวิชาได้" };

  const course = await withUniqueJoinCode((joinCode) =>
    prisma.course.create({ data: { name: name.data, joinCode, teacherId: user.id } })
  );

  revalidatePath("/", "layout");
  redirect(`/courses/${course.id}`);
}

/** รหัสเดิมหลุดไปนอกห้อง → สุ่มใหม่ บอร์ดที่ผูกไว้แล้วไม่กระทบ */
export async function regenerateJoinCodeAction(formData: FormData) {
  const course = await ownCourse(formData.get("courseId"));
  if (!course) return;

  await withUniqueJoinCode((joinCode) =>
    prisma.course.update({ where: { id: course.id }, data: { joinCode } })
  );

  revalidatePath(`/courses/${course.id}`);
}

/** ถอนบอร์ดออกจากวิชา — สิทธิ์ของอาจารย์เท่านั้น (เจ้าของบอร์ดถอนเองไม่ได้) */
export async function unlinkBoardAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const course = await ownCourse(formData.get("courseId"));
  if (!course || typeof boardId !== "string") return;

  await prisma.$transaction(async (tx) => {
    const unlinked = await tx.board.updateMany({
      where: { id: boardId, courseId: course.id },
      data: { courseId: null },
    });
    // การ์ดงานของวิชานี้กลายเป็นการ์ดธรรมดา — ไม่งั้นยังล็อกและยังเปลี่ยนตามที่อาจารย์แก้ ทั้งที่ออกจากวิชาแล้ว
    if (unlinked.count > 0) await detachAssignmentCards(tx, { list: { boardId } });
  });

  revalidatePath(`/courses/${course.id}`);
  revalidatePath(`/board/${boardId}`);
  revalidatePath("/review");
}

/** ลบวิชา — บอร์ดในวิชากลับเป็นบอร์ดส่วนตัว (onDelete: SetNull) ผลตรวจบนการ์ดยังอยู่ */
export async function deleteCourseAction(formData: FormData) {
  const course = await ownCourse(formData.get("courseId"));
  if (!course) return;

  // SetNull ปลดล็อกการ์ดงานให้เองอยู่แล้ว แต่ล้างธง fromAssignment ด้วยให้ข้อมูลไม่ค้างครึ่ง ๆ
  await prisma.$transaction(async (tx) => {
    await detachAssignmentCards(tx, { assignment: { courseId: course.id } });
    await tx.course.delete({ where: { id: course.id } });
  });

  revalidatePath("/", "layout");
  redirect("/courses");
}

/** หน้าที่โชว์การ์ดงาน: รายวิชา บอร์ดที่มีสำเนา dashboard ปฏิทิน และหน้าตรวจงาน */
function revalidateAssignment(courseId: string, boardIds: string[]) {
  revalidatePath(`/courses/${courseId}`);
  for (const boardId of boardIds) revalidatePath(`/board/${boardId}`);
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/review");
}

/**
 * สร้าง/แก้งานที่มอบหมาย — ข้อมูลมาเป็น JSON ก้อนเดียวใน payload (งานย่อยเป็น array เรียงลำดับ)
 * งานที่แจกแล้ว: การ์ดสำเนาทุกบอร์ดเปลี่ยนตามใน transaction เดียวกัน (applyAssignmentEdit)
 */
export async function saveAssignmentAction(
  _state: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const course = await ownCourse(formData.get("courseId"));
  if (!course) return { error: "ไม่พบรายวิชานี้" };

  const payload = formData.get("payload");
  if (typeof payload !== "string") return { error: "ข้อมูลไม่ครบ" };
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return { error: "ข้อมูลไม่ถูกต้อง" };
  }
  const parsed = assignmentInputSchema.safeParse(json);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const input = parsed.data;

  const assignmentId = formData.get("assignmentId");
  let boardIds: string[] = [];

  if (typeof assignmentId === "string" && assignmentId) {
    const existing = await prisma.assignment.findFirst({
      where: { id: assignmentId, courseId: course.id },
      select: { id: true, publishedAt: true, items: { select: { id: true, content: true, position: true } } },
    });
    if (!existing) return { error: "ไม่พบงานนี้ อาจถูกลบไปแล้ว" };

    const diff = diffAssignmentItems(existing.items, input.items);
    boardIds = await prisma.$transaction(
      (tx) => applyAssignmentEdit(tx, existing, input, diff),
      ASSIGNMENT_TX_OPTIONS
    );
  } else {
    await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        items: { create: input.items.map((item, index) => ({ content: item.content, position: index + 1 })) },
      },
    });
  }

  revalidateAssignment(course.id, boardIds);
  return { savedAt: Date.now() };
}

/** แจกงานร่างให้ทุกบอร์ดในวิชา — บอร์ดที่ผูกทีหลังได้งานตอนผูก (linkBoardToCourseAction) */
export async function publishAssignmentAction(formData: FormData) {
  const course = await ownCourse(formData.get("courseId"));
  const assignmentId = formData.get("assignmentId");
  if (!course || typeof assignmentId !== "string") return;
  const teacher = await getCurrentUser();

  const boardIds = await prisma.$transaction(async (tx) => {
    // เงื่อนไข publishedAt: null = กดแจกพร้อมกันสองแท็บแล้วไม่ได้การ์ดสองชุด
    const published = await tx.assignment.updateMany({
      where: { id: assignmentId, courseId: course.id, publishedAt: null },
      data: { publishedAt: new Date() },
    });
    if (published.count === 0) return [];

    const [assignment, boards] = await Promise.all([
      tx.assignment.findUniqueOrThrow({ where: { id: assignmentId }, select: assignmentDistributeSelect }),
      tx.board.findMany({ where: { courseId: course.id }, select: { id: true } }),
    ]);
    return distributeAssignments(tx, {
      assignments: [assignment],
      boardIds: boards.map((board) => board.id),
      teacher,
    });
  }, ASSIGNMENT_TX_OPTIONS);

  revalidateAssignment(course.id, boardIds);
}

/**
 * ลบงาน — ร่างลบได้เสมอ งานที่แจกแล้วลบได้เฉพาะตอนยังไม่มีบอร์ดไหนส่ง (canDeleteAssignment)
 * และลบการ์ดสำเนาออกจากทุกบอร์ดด้วย (ไว้แก้ตอนแจกผิด) — ทางเดียวที่การ์ดงานถูกลบได้
 */
export async function deleteAssignmentAction(formData: FormData) {
  const course = await ownCourse(formData.get("courseId"));
  const assignmentId = formData.get("assignmentId");
  if (!course || typeof assignmentId !== "string") return;
  const teacher = await getCurrentUser();

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findFirst({
      where: { id: assignmentId, courseId: course.id },
      select: {
        id: true,
        title: true,
        publishedAt: true,
        cards: {
          select: {
            submittedAt: true,
            completedAt: true,
            review: { select: { status: true } },
            list: { select: { boardId: true } },
          },
        },
      },
    });
    if (!assignment) return null;
    const copies = assignment.cards.map((card) => ({
      submittedAt: card.submittedAt,
      completedAt: card.completedAt,
      reviewStatus: card.review?.status ?? null,
    }));
    // เช็คใน transaction — หน้าที่เปิดค้างไว้อาจยังโชว์ปุ่มลบ ทั้งที่นักศึกษาเพิ่งส่งงาน
    if (!canDeleteAssignment(assignment, copies)) return null;

    const attachments = await tx.attachment.findMany({
      where: { card: { assignmentId: assignment.id }, blobPathname: { not: null } },
      select: { blobPathname: true },
    });
    await tx.card.deleteMany({ where: { assignmentId: assignment.id } });
    await tx.assignment.delete({ where: { id: assignment.id } });

    const boardIds = [...new Set(assignment.cards.map((card) => card.list.boardId))];
    if (boardIds.length > 0) {
      await tx.activity.createMany({
        data: boardIds.map((boardId) => ({
          boardId,
          userId: teacher.id,
          type: ActivityType.CARD_DELETED,
          message: `${teacher.name ?? teacher.email} removed assignment "${assignment.title}"`,
        })),
      });
    }
    return { boardIds, blobs: attachments.flatMap((attachment) => attachment.blobPathname ?? []) };
  }, ASSIGNMENT_TX_OPTIONS);
  if (!result) return;

  // ลบไฟล์หลัง transaction สำเร็จเท่านั้น — ล้มตรงนี้แค่ไฟล์ค้างใน Blob ข้อมูลใน DB ถูกต้องแล้ว
  if (result.blobs.length > 0) {
    try {
      await del(result.blobs);
    } catch (error) {
      console.error("deleteAssignmentAction: ลบไฟล์ใน Blob ไม่สำเร็จ", error);
    }
  }

  revalidateAssignment(course.id, result.boardIds);
}

const STATUS_LABEL = {
  NOT_SUBMITTED: "ยังไม่ส่ง",
  PENDING: "รอตรวจ",
  APPROVED: "อนุมัติ",
  CHANGES_REQUESTED: "ส่งกลับแก้ไข",
} as const;

const DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * คะแนนทั้งวิชาเป็น CSV — 1 แถวต่อการ์ดของทุกบอร์ดในวิชา
 * คืนเป็น string ให้ client สร้างไฟล์ดาวน์โหลดเอง (โปรเจกต์นี้ไม่มี API route นอกจากของ NextAuth)
 */
export async function exportCourseScoresAction(
  courseId: string
): Promise<{ filename: string; csv: string } | { error: string }> {
  const course = await ownCourse(courseId);
  if (!course) return { error: "ไม่พบรายวิชานี้" };

  const people = { select: { name: true, email: true } } as const;
  const cards = await prisma.card.findMany({
    where: { list: { board: { courseId: course.id } } },
    orderBy: [{ list: { board: { name: "asc" } } }, { list: { position: "asc" } }, { position: "asc" }],
    select: {
      title: true,
      dueDate: true,
      submittedAt: true,
      assignment: { select: { title: true } },
      list: { select: { name: true, isReviewList: true, board: { select: { name: true } } } },
      submittedBy: people,
      createdBy: people,
      assignees: { select: { user: people } },
      review: { select: { status: true, score: true, feedback: true, updatedAt: true } },
    },
  });

  const name = (user: { name: string | null; email: string }) => user.name ?? user.email;

  const rows = cards.map((card) => {
    // การ์ดงานจากอาจารย์ createdBy = อาจารย์ — ยังไม่มีใครส่งต้องเว้นว่าง ไม่ใช่โชว์ว่าอาจารย์เป็นผู้ส่ง
    const submitter = card.submittedBy ?? (card.assignment ? null : card.createdBy);
    // อยู่ในคอลัมน์ตรวจ = รอตรวจ แม้จะเคยถูกส่งกลับแก้ไขมาก่อนแล้วส่งใหม่
    // เคยส่งแต่นักศึกษาลากออกเองก่อนอาจารย์ตรวจ = ถือว่ายังไม่ส่ง
    const status = card.list.isReviewList ? "PENDING" : (card.review?.status ?? "NOT_SUBMITTED");
    return [
      card.list.board.name,
      card.list.name,
      card.title,
      // ว่าง = การ์ดที่นักศึกษาสร้างเอง
      card.assignment?.title ?? null,
      submitter ? name(submitter) : null,
      submitter?.email ?? null,
      card.assignees.map((assignee) => name(assignee.user)).join(", "),
      STATUS_LABEL[status],
      card.review?.status === "APPROVED" ? card.review.score : null,
      card.submittedAt ? DATE_TIME.format(card.submittedAt) : null,
      card.dueDate ? dateKey(card.dueDate) : null,
      card.dueDate && card.submittedAt ? (isOnTime(card.dueDate, card.submittedAt) ? "ทัน" : "ช้า") : null,
      card.review ? DATE_TIME.format(card.review.updatedAt) : null,
      card.review?.feedback ?? null,
    ];
  });

  const header = [
    "บอร์ด",
    "คอลัมน์",
    "การ์ด",
    "งานที่มอบหมาย",
    "ผู้ส่ง",
    "อีเมลผู้ส่ง",
    "ผู้รับผิดชอบ",
    "สถานะ",
    "คะแนน",
    "ส่งเมื่อ",
    "กำหนดส่ง",
    "ทันกำหนด",
    "ตรวจเมื่อ",
    "ความเห็น",
  ];

  // ชื่อไฟล์ใช้ได้ทุก OS: ตัดอักขระต้องห้ามของ Windows ออก
  const safeName = course.name.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60);
  return { filename: `คะแนน-${safeName}-${dateKey(new Date())}.csv`, csv: toCsv([header, ...rows]) };
}

const splitDraftSchema = assignmentInputSchema.pick({ title: true, description: true });

/**
 * ให้ AI แตกงานเป็นงานย่อย — **ไม่เขียน DB** ผลไปเติมในหน้าต่างของอาจารย์ (งานยังเป็นร่างจนกว่าจะกดแจก)
 * settingsOverride = ปุ่ม "ลองแตกดู" ในหน้าตั้งค่า ที่ใช้ค่าที่ยังไม่ได้บันทึก (ตรวจด้วย schema เดียวกับตอนบันทึก)
 * เฉพาะอาจารย์เจ้าของวิชา — กันคนอื่นใช้โควตา API ของวิชา
 */
export async function splitAssignmentAction(
  courseId: string,
  draft: { title: string; description: string; assignmentId?: string },
  settingsOverride?: unknown
): Promise<SplitResult> {
  const course = await ownCourse(courseId);
  if (!course) return { error: "ไม่พบรายวิชานี้" };

  const task = splitDraftSchema.safeParse({ title: draft?.title ?? "", description: draft?.description ?? "" });
  if (!task.success) return { error: task.error.issues[0]?.message ?? "กรอกชื่องานก่อน" };

  let settings: SplitterSettings;
  if (settingsOverride === undefined) {
    const stored = await prisma.course.findUnique({ where: { id: course.id }, select: { splitterSettings: true } });
    settings = readSplitterSettings(stored?.splitterSettings);
  } else {
    const parsed = splitterSettingsSchema.safeParse(settingsOverride);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ค่าตั้งค่าไม่ถูกต้อง" };
    settings = parsed.data;
  }

  // งานเก่าของวิชา (รวมร่าง) = สไตล์การแตกงานของอาจารย์ — มีแต่เนื้องาน ไม่มีข้อมูลนักศึกษา
  const examples = settings.learnFromPast
    ? pickExamples(
        await prisma.assignment.findMany({
          where: { courseId: course.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
            items: { orderBy: { position: "asc" }, select: { content: true } },
          },
        }),
        {
          id: typeof draft?.assignmentId === "string" ? draft.assignmentId : undefined,
          title: task.data.title,
        }
      )
    : [];

  return splitTask(task.data, settings, examples);
}

/** บันทึกค่าปรับจูนตัวแตกงานของวิชา — ข้อมูลมาเป็น JSON ใน payload เหมือนฟอร์มงานที่มอบหมาย */
export async function saveSplitterSettingsAction(
  _state: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const course = await ownCourse(formData.get("courseId"));
  if (!course) return { error: "ไม่พบรายวิชานี้" };

  const payload = formData.get("payload");
  let json: unknown;
  try {
    json = typeof payload === "string" ? JSON.parse(payload) : undefined;
  } catch {
    return { error: "ข้อมูลไม่ถูกต้อง" };
  }
  const parsed = splitterSettingsSchema.safeParse(json);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ค่าตั้งค่าไม่ถูกต้อง" };

  await prisma.course.update({ where: { id: course.id }, data: { splitterSettings: parsed.data } });
  revalidatePath(`/courses/${course.id}`);
  return { savedAt: Date.now() };
}
