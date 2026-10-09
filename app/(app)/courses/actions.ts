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

export type CourseFormState = { error?: string } | undefined;

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

  await prisma.board.updateMany({
    where: { id: boardId, courseId: course.id },
    data: { courseId: null },
  });

  revalidatePath(`/courses/${course.id}`);
  revalidatePath(`/board/${boardId}`);
  revalidatePath("/review");
}

/** ลบวิชา — บอร์ดในวิชากลับเป็นบอร์ดส่วนตัว (onDelete: SetNull) ผลตรวจบนการ์ดยังอยู่ */
export async function deleteCourseAction(formData: FormData) {
  const course = await ownCourse(formData.get("courseId"));
  if (!course) return;

  await prisma.course.delete({ where: { id: course.id } });

  revalidatePath("/", "layout");
  redirect("/courses");
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
      list: { select: { name: true, isReviewList: true, board: { select: { name: true } } } },
      submittedBy: people,
      createdBy: people,
      assignees: { select: { user: people } },
      review: { select: { status: true, score: true, feedback: true, updatedAt: true } },
    },
  });

  const name = (user: { name: string | null; email: string }) => user.name ?? user.email;

  const rows = cards.map((card) => {
    const submitter = card.submittedBy ?? card.createdBy;
    // อยู่ในคอลัมน์ตรวจ = รอตรวจ แม้จะเคยถูกส่งกลับแก้ไขมาก่อนแล้วส่งใหม่
    // เคยส่งแต่นักศึกษาลากออกเองก่อนอาจารย์ตรวจ = ถือว่ายังไม่ส่ง
    const status = card.list.isReviewList ? "PENDING" : (card.review?.status ?? "NOT_SUBMITTED");
    return [
      card.list.board.name,
      card.list.name,
      card.title,
      name(submitter),
      submitter.email,
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
