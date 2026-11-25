import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { ActivityType } from "@/app/generated/prisma/enums";
import { positionBetween } from "./drag";
import {
  ASSIGNMENT_CHECKLIST_TITLE,
  pickAssignmentList,
  type AssignmentInput,
  type diffAssignmentItems,
} from "./assignment-rules";

/*
 * งานที่อาจารย์มอบหมาย — ส่วนที่แตะ DB ทั้งหมดอยู่ที่นี่ (กติกาบริสุทธิ์อยู่ที่ lib/assignment-rules.ts)
 * ทุกฟังก์ชันรับ tx ให้ผู้เรียกรวมไว้ใน transaction เดียวกับงานของตัวเอง
 */

type Tx = Prisma.TransactionClient;

/** แจกงานผ่านหลายสิบบอร์ดใน transaction เดียว — ค่าเริ่มต้น 5 วิของ Prisma ไม่พอ */
export const ASSIGNMENT_TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 };

export const assignmentDistributeSelect = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  items: { orderBy: { position: "asc" }, select: { id: true, content: true, position: true } },
} satisfies Prisma.AssignmentSelect;

export type AssignmentToDistribute = Prisma.AssignmentGetPayload<{ select: typeof assignmentDistributeSelect }>;

/**
 * สร้างการ์ดของงานให้ทุกคู่ บอร์ด × งาน ที่ยังไม่มี — ทางเข้าเดียวของการแจกงาน
 * เรียกจาก publishAssignmentAction (ทุกบอร์ดในวิชา) และ linkBoardToCourseAction (บอร์ดที่เพิ่งผูก)
 * **ทางเข้าใหม่ที่ทำให้บอร์ดเข้าวิชาได้ ต้องเรียกฟังก์ชันนี้ด้วย** ไม่งั้นบอร์ดนั้นไม่ได้งาน
 *
 * ข้ามคู่ที่มีการ์ดอยู่แล้ว จึงเรียกซ้ำได้ไม่เกิดการ์ดซ้ำ
 * assignments ควรเรียงจากเก่าไปใหม่ — การ์ดถูกวางบนสุดทีละใบ งานใหม่สุดจึงอยู่บนสุด
 * @returns id ของบอร์ดที่ได้การ์ดใหม่ (ไว้ revalidate)
 */
export async function distributeAssignments(
  tx: Tx,
  {
    assignments,
    boardIds,
    teacher,
  }: {
    assignments: AssignmentToDistribute[];
    boardIds: string[];
    teacher: { id: string; name: string | null; email: string };
  }
): Promise<string[]> {
  if (assignments.length === 0 || boardIds.length === 0) return [];

  const [existing, lists] = await Promise.all([
    tx.card.findMany({
      where: { assignmentId: { in: assignments.map((assignment) => assignment.id) }, list: { boardId: { in: boardIds } } },
      select: { assignmentId: true, list: { select: { boardId: true } } },
    }),
    tx.list.findMany({
      where: { boardId: { in: boardIds } },
      select: { id: true, boardId: true, position: true, isDoneList: true, isReviewList: true },
    }),
  ]);
  const has = new Set(existing.map((card) => `${card.list.boardId}:${card.assignmentId}`));

  // คอลัมน์ปลายทางของแต่ละบอร์ด — บอร์ดที่มีแต่คอลัมน์ตรวจ/เสร็จสิ้นได้คอลัมน์ใหม่ไว้หน้าสุด
  const targets = new Map<string, string>();
  for (const boardId of boardIds) {
    const boardLists = lists.filter((list) => list.boardId === boardId);
    const target = pickAssignmentList(boardLists);
    if (target) {
      targets.set(boardId, target.id);
      continue;
    }
    const first = Math.min(...boardLists.map((list) => list.position));
    const created = await tx.list.create({
      data: { boardId, name: "สิ่งที่ต้องทำ", position: positionBetween(undefined, Number.isFinite(first) ? first : undefined) },
      select: { id: true },
    });
    targets.set(boardId, created.id);
  }

  const tops = await tx.card.groupBy({
    by: ["listId"],
    where: { listId: { in: [...targets.values()] } },
    _min: { position: true },
  });
  const topOf = new Map(tops.map((row) => [row.listId, row._min.position ?? undefined]));

  const touched: string[] = [];
  const activities: Prisma.ActivityCreateManyInput[] = [];
  const teacherName = teacher.name ?? teacher.email;

  for (const boardId of boardIds) {
    const missing = assignments.filter((assignment) => !has.has(`${boardId}:${assignment.id}`));
    if (missing.length === 0) continue;

    const listId = targets.get(boardId)!;
    let top = topOf.get(listId);
    for (const assignment of missing) {
      top = positionBetween(undefined, top);
      const card = await tx.card.create({
        data: {
          listId,
          position: top,
          title: assignment.title,
          description: assignment.description,
          dueDate: assignment.dueDate,
          createdById: teacher.id,
          assignmentId: assignment.id,
          // สร้างเช็กลิสต์ของอาจารย์เสมอแม้ยังไม่มีงานย่อย — อาจารย์เพิ่มข้อทีหลังจะได้มีที่ลง
          checklists: {
            create: {
              title: ASSIGNMENT_CHECKLIST_TITLE,
              position: 0,
              fromAssignment: true,
              items: {
                create: assignment.items.map((item) => ({
                  content: item.content,
                  position: item.position,
                  assignmentItemId: item.id,
                })),
              },
            },
          },
        },
        select: { id: true },
      });
      activities.push({
        boardId,
        cardId: card.id,
        userId: teacher.id,
        type: ActivityType.CARD_CREATED,
        message: `${teacherName} assigned "${assignment.title}"`,
      });
    }
    touched.push(boardId);
  }

  if (activities.length > 0) await tx.activity.createMany({ data: activities });
  return touched;
}

/**
 * บันทึกการแก้งาน — งานที่แจกแล้วจะแก้การ์ดสำเนาทุกบอร์ดตามไปด้วย
 * ติ๊กของนักศึกษา (isCompleted) ไม่ถูกแตะ ข้อที่แค่แก้คำจึงยังติ๊กอยู่
 * @returns id ของบอร์ดที่มีสำเนา (ไว้ revalidate) — งานร่างคืน []
 */
export async function applyAssignmentEdit(
  tx: Tx,
  assignment: { id: string; publishedAt: Date | null },
  input: AssignmentInput,
  diff: ReturnType<typeof diffAssignmentItems>
): Promise<string[]> {
  const published = assignment.publishedAt !== null;
  const fields = { title: input.title, description: input.description, dueDate: input.dueDate };

  await tx.assignment.update({ where: { id: assignment.id }, data: fields });

  if (diff.remove.length > 0) {
    // ลบข้อของสำเนาก่อน — ไม่งั้น SetNull ทำให้ข้อเหล่านั้นค้างเป็นข้อธรรมดาในทุกบอร์ด
    if (published) await tx.checklistItem.deleteMany({ where: { assignmentItemId: { in: diff.remove } } });
    await tx.assignmentItem.deleteMany({ where: { id: { in: diff.remove }, assignmentId: assignment.id } });
  }

  for (const item of diff.update) {
    await tx.assignmentItem.update({
      where: { id: item.id, assignmentId: assignment.id },
      data: { content: item.content, position: item.position },
    });
    if (published) {
      await tx.checklistItem.updateMany({
        where: { assignmentItemId: item.id },
        data: { content: item.content, position: item.position },
      });
    }
  }

  const checklists = published
    ? await tx.checklist.findMany({
        where: { fromAssignment: true, card: { assignmentId: assignment.id } },
        select: { id: true },
      })
    : [];
  for (const item of diff.create) {
    const created = await tx.assignmentItem.create({
      data: { assignmentId: assignment.id, content: item.content, position: item.position },
      select: { id: true },
    });
    if (checklists.length > 0) {
      await tx.checklistItem.createMany({
        data: checklists.map((checklist) => ({
          checklistId: checklist.id,
          content: item.content,
          position: item.position,
          assignmentItemId: created.id,
        })),
      });
    }
  }

  if (!published) return [];

  await tx.card.updateMany({ where: { assignmentId: assignment.id }, data: fields });
  const copies = await tx.card.findMany({
    where: { assignmentId: assignment.id },
    select: { list: { select: { boardId: true } } },
  });
  return [...new Set(copies.map((card) => card.list.boardId))];
}

/**
 * ตัดการ์ดออกจากงาน — กลายเป็นการ์ดธรรมดาของนักศึกษาที่แก้/ลบได้ ไม่มีข้อมูลหาย
 * ใช้ตอนอาจารย์ถอนบอร์ดออกจากวิชา และตอนลบวิชา
 */
export async function detachAssignmentCards(tx: Tx, where: Prisma.CardWhereInput): Promise<void> {
  const cards = await tx.card.findMany({
    where: { AND: [where, { assignmentId: { not: null } }] },
    select: { id: true },
  });
  if (cards.length === 0) return;
  const cardIds = cards.map((card) => card.id);

  await tx.checklistItem.updateMany({
    where: { checklist: { cardId: { in: cardIds } }, assignmentItemId: { not: null } },
    data: { assignmentItemId: null },
  });
  await tx.checklist.updateMany({
    where: { cardId: { in: cardIds }, fromAssignment: true },
    data: { fromAssignment: false },
  });
  await tx.card.updateMany({ where: { id: { in: cardIds } }, data: { assignmentId: null } });
}
