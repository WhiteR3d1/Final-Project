"use server";

import { parseCardCreate } from "@/lib/card-create";
import { z } from "zod";
import { randomUUID } from "crypto";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { assertBoardAccess, type BoardAccess } from "@/lib/board-access";
import { ActivityType, BoardRole, InviteStatus } from "@/app/generated/prisma/enums";
import { syncCardCompletion } from "@/lib/card-completion";
import { insertListPosition, isDoneListName, positionBetween } from "@/lib/drag";
import { normalizeJoinCode } from "@/lib/join-code";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
  attachmentKindForUpload,
  attachmentNameFromUrl,
  isWithinAttachmentSizeLimit,
  sanitizeAttachmentUrl,
} from "@/lib/attachments";

/** ค่าจาก FormData เป็น unknown เสมอ — ตัวช่วยอ่านช่องที่ปล่อยว่างได้ให้เป็น null */
function optionalText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function createListAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const name = formData.get("name");
  // แทรกข้างคอลัมน์ไหน (จากเมนู ⋯) — ไม่ส่งมา = ต่อท้าย
  const anchorListId = formData.get("anchorListId");
  const side = formData.get("side") === "before" ? "before" : "after";

  if (typeof boardId !== "string" || typeof name !== "string" || !name.trim()) {
    return;
  }

  const user = await getCurrentUser();
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  // คำนวณตำแหน่งจากคอลัมน์จริงใน DB ไม่เชื่อตำแหน่งจาก client
  const lists = await prisma.list.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    select: { id: true, position: true, isDoneList: true },
  });

  // ตามคำแนะนำของอาจารย์: บอร์ดที่ยังไม่มีคอลัมน์เสร็จสิ้น ตั้งชื่อว่า Done/เสร็จสิ้น = เป็นคอลัมน์เสร็จสิ้นเลย
  const autoDone = isDoneListName(name) && !lists.some((list) => list.isDoneList);

  await prisma.list.create({
    data: {
      boardId,
      name: name.trim(),
      color: optionalText(formData.get("color")),
      description: optionalText(formData.get("description")),
      isDoneList: autoDone,
      // คอลัมน์เสร็จสิ้นอยู่ขวาสุดเสมอ คอลัมน์อื่นจึงแทรกได้แค่ก่อนหน้ามัน
      position: autoDone
        ? positionBetween(lists[lists.length - 1]?.position, undefined)
        : insertListPosition(lists, typeof anchorListId === "string" ? anchorListId : null, side),
    },
  });

  revalidatePath(`/board/${boardId}`);
  if (autoDone) revalidatePath("/");
}

/** แก้ชื่อ/สี/คำอธิบายของคอลัมน์ — ทางเดียวที่ใช้แก้คอลัมน์ (ทั้งกดที่ชื่อและเมนู ⋯) */
export async function updateListAction(formData: FormData) {
  const listId = formData.get("listId");
  const name = formData.get("name");

  if (typeof listId !== "string" || typeof name !== "string" || !name.trim()) {
    return;
  }

  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  const access = await assertBoardAccess(list.boardId, user);
  if (!access?.canEdit) return;

  // เปลี่ยนชื่อเป็น Done/เสร็จสิ้น ในบอร์ดที่ยังไม่มีคอลัมน์เสร็จสิ้น = ตั้งธงให้เลย (เหมือนตอนสร้าง)
  const shouldFlagDone =
    !list.isDoneList &&
    isDoneListName(name) &&
    (await prisma.list.count({ where: { boardId: list.boardId, isDoneList: true } })) === 0;

  await prisma.$transaction(async (tx) => {
    await tx.list.update({
      where: { id: listId },
      data: {
        name: name.trim(),
        color: optionalText(formData.get("color")),
        description: optionalText(formData.get("description")),
      },
    });
    if (shouldFlagDone) await flagDoneList(tx, list.boardId, listId);
  });

  revalidatePath(`/board/${list.boardId}`);
  if (shouldFlagDone) revalidatePath("/");
}

export async function deleteListAction(formData: FormData) {
  const listId = formData.get("listId");
  if (typeof listId !== "string") return;

  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  const access = await assertBoardAccess(list.boardId, user);
  if (!access?.canEdit) return;
  // บอร์ดในรายวิชา: ลบคอลัมน์ = การ์ดและผลตรวจข้างในหายตาม คะแนนจะหายจาก CSV ของอาจารย์
  if (access.courseId && (await prisma.cardReview.count({ where: { card: { listId } } })) > 0) return;

  await prisma.list.delete({ where: { id: listId } });

  await prisma.activity.create({
    data: {
      boardId: list.boardId,
      userId: user.id,
      type: ActivityType.LIST_DELETED,
      message: `${user.name ?? user.email} deleted list "${list.name}"`,
    },
  });

  revalidatePath(`/board/${list.boardId}`);
}

export async function reorderListAction(listId: string, newPosition: number) {
  // เรียกจาก client ตรง ๆ ค่าที่ส่งมาจึงเป็นอะไรก็ได้ — NaN/Infinity ทำลำดับคอลัมน์พังทั้งบอร์ด
  if (typeof listId !== "string" || !Number.isFinite(newPosition)) return;

  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  const access = await assertBoardAccess(list.boardId, user);
  if (!access?.canEdit) return;

  // คอลัมน์เสร็จสิ้นอยู่ขวาสุดเสมอ — ตัวมันเองลากไม่ได้ และคอลัมน์อื่นห้ามเลยมันไป
  // (ฝั่ง client กันไว้แล้วด้วย clampBeforeDone แต่ client ถูกข้ามได้)
  if (list.isDoneList) return;

  let position = newPosition;
  const doneList = await prisma.list.findFirst({
    where: { boardId: list.boardId, isDoneList: true },
    select: { position: true },
  });
  if (doneList && position >= doneList.position) {
    const before = await prisma.list.findFirst({
      where: { boardId: list.boardId, id: { not: listId }, position: { lt: doneList.position } },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = positionBetween(before?.position, doneList.position);
  }

  await prisma.list.update({
    where: { id: listId },
    data: { position },
  });

  revalidatePath(`/board/${list.boardId}`);
}

/**
 * priority / ป้าย / ผู้รับผิดชอบ ที่ client ส่งมาต้องเป็นของบอร์ดนี้จริง ไม่งั้นผูกของบอร์ดอื่น
 * (หรือผู้ใช้คนไหนก็ได้ในระบบ) เข้าการ์ดได้ — owner ไม่มีแถวใน BoardMember จึงต้องนับ ownerId แยก
 */
async function cardRefsInBoard(
  db: Prisma.TransactionClient,
  board: Pick<BoardAccess, "id" | "ownerId">,
  { priorityId = null, labelIds = [], assigneeIds = [] }: {
    priorityId?: string | null; labelIds?: string[]; assigneeIds?: string[];
  },
): Promise<boolean> {
  if (priorityId && !(await db.priority.findFirst({ where: { id: priorityId, boardId: board.id }, select: { id: true } })))
    return false;

  const uniqueLabelIds = [...new Set(labelIds)];
  if (uniqueLabelIds.length &&
    (await db.label.count({ where: { id: { in: uniqueLabelIds }, boardId: board.id } })) !== uniqueLabelIds.length)
    return false;

  const memberIds = [...new Set(assigneeIds)].filter((id) => id !== board.ownerId);
  return !memberIds.length ||
    (await db.boardMember.count({ where: { boardId: board.id, userId: { in: memberIds } } })) === memberIds.length;
}

export async function createCardAction(formData: FormData): Promise<
  { ok: true; cardId: string } | { ok: false; error: string }
> {
  const parsed = parseCardCreate(formData);
  if (!parsed.success) return { ok: false, error: "ตรวจสอบชื่อการ์ด วันที่ เช็กลิสต์ และลิงก์ให้ถูกต้อง" };
  const input = parsed.data;
  const user = await getCurrentUser();
  const list = await prisma.list.findUnique({ where: { id: input.listId }, select: { boardId: true } });
  if (!list) return { ok: false, error: "ไม่พบคอลัมน์นี้" };
  const access = await assertBoardAccess(list.boardId, user);
  if (!access?.canEdit) return { ok: false, error: "ไม่มีสิทธิ์เพิ่มการ์ดในบอร์ดนี้" };

  // ใช้ ID เดิมเมื่อ retry หลังคำตอบขาดหาย ป้องกันสร้างการ์ดซ้ำ
  const existing = await prisma.card.findUnique({ where: { id: input.requestId } });
  if (existing) {
    if (existing.createdById !== user.id || existing.listId !== input.listId)
      return { ok: false, error: "คำขอสร้างการ์ดไม่ถูกต้อง" };
    revalidatePath(`/board/${list.boardId}`);
    return { ok: true, cardId: existing.id };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (!(await cardRefsInBoard(tx, access, input)))
        return { ok: false as const, error: "ระดับความสำคัญ ป้าย หรือผู้รับผิดชอบไม่อยู่ในบอร์ดนี้" };
      const last = await tx.card.findFirst({ where: { listId: input.listId }, orderBy: { position: "desc" } });
      const card = await tx.card.create({ data: {
        id: input.requestId, listId: input.listId, title: input.title,
        description: input.description || null, dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priorityId: input.priorityId || null, position: (last?.position ?? 0) + 1, createdById: user.id,
        labels: { create: input.labelIds.map((labelId) => ({ labelId })) },
        assignees: { create: input.assigneeIds.map((userId) => ({ userId })) },
        checklists: { create: input.checklists.map((checklist, position) => ({
          title: checklist.title, position,
          items: { create: checklist.items.map((item, position) => ({ ...item, position })) },
        })) },
        attachments: { create: input.links.map((url) => ({ type: "LINK", name: attachmentNameFromUrl(url), url, uploadedById: user.id })) },
        comments: { create: input.comment ? [{ content: input.comment, userId: user.id }] : [] },
        activities: { create: { boardId: list.boardId, userId: user.id, type: ActivityType.CARD_CREATED,
          message: `${user.name ?? user.email} created card "${input.title}"` } },
      } });
      return { ok: true as const, cardId: card.id };
    });
    revalidatePath(`/board/${list.boardId}`);
    return result;
  } catch {
    return { ok: false, error: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังอยู่" };
  }
}

export async function moveCardAction(
  cardId: string,
  direction: "left" | "right"
): Promise<{ awarded: number } | { error: string } | undefined> {
  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: {
      list: {
        include: {
          board: { include: { lists: { orderBy: { position: "asc" } } } },
        },
      },
    },
  });

  const access = await assertBoardAccess(card.list.boardId, user);
  if (!access?.canEdit) return;

  const lists = card.list.board.lists;
  const currentIndex = lists.findIndex((l) => l.id === card.listId);
  const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= lists.length) return;

  const targetList = lists[targetIndex];
  if (needsTeacherApproval(access, targetList, true)) {
    return { error: REVIEW_REQUIRED_ERROR };
  }

  const lastCardInTarget = await prisma.card.findFirst({
    where: { listId: targetList.id },
    orderBy: { position: "desc" },
  });

  const awarded = await prisma.$transaction(async (tx) => {
    await tx.card.update({
      where: { id: cardId },
      data: {
        listId: targetList.id,
        position: (lastCardInTarget?.position ?? 0) + 1,
        ...submissionFields(targetList, true, user.id),
      },
    });

    await tx.activity.create({
      data: {
        boardId: card.list.boardId,
        cardId: card.id,
        userId: user.id,
        type: ActivityType.CARD_MOVED,
        message: `${user.name ?? user.email} moved "${card.title}" to ${targetList.name}`,
        data: { fromListId: card.listId, toListId: targetList.id },
      },
    });

    return syncCardCompletion(tx, card, targetList, card.list.boardId, user);
  });

  revalidatePath(`/board/${card.list.boardId}`);
  if (targetList.isReviewList || card.list.isReviewList) revalidatePath("/review");
  if (awarded > 0) revalidatePath("/");

  return { awarded };
}

export async function reorderCardAction(
  cardId: string,
  targetListId: string,
  newPosition: number
): Promise<{ awarded: number } | { error: string } | undefined> {
  if (!Number.isFinite(newPosition)) return;

  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: true },
  });

  const access = await assertBoardAccess(card.list.boardId, user);
  if (!access?.canEdit) return;

  const boardLists = await prisma.list.findMany({
    where: { boardId: card.list.boardId },
    select: { id: true, name: true, isDoneList: true, isReviewList: true },
  });
  const targetList = boardLists.find((list) => list.id === targetListId);
  // ปลายทางต้องอยู่บอร์ดเดียวกัน ไม่งั้นย้ายการ์ดข้ามไปบอร์ดที่ไม่มีสิทธิ์ได้
  if (!targetList) return;

  const listChanged = targetListId !== card.listId;
  if (needsTeacherApproval(access, targetList, listChanged)) {
    return { error: REVIEW_REQUIRED_ERROR };
  }

  const awarded = await prisma.$transaction(async (tx) => {
    await tx.card.update({
      where: { id: cardId },
      data: {
        listId: targetListId,
        position: newPosition,
        ...submissionFields(targetList, listChanged, user.id),
      },
    });

    if (listChanged) {
      await tx.activity.create({
        data: {
          boardId: card.list.boardId,
          cardId: card.id,
          userId: user.id,
          type: ActivityType.CARD_MOVED,
          message: `${user.name ?? user.email} moved "${card.title}" to ${targetList.name}`,
          data: { fromListId: card.listId, toListId: targetListId },
        },
      });
    }

    return syncCardCompletion(tx, card, targetList, card.list.boardId, user);
  });

  revalidatePath(`/board/${card.list.boardId}`);
  if (listChanged && (targetList.isReviewList || card.list.isReviewList)) revalidatePath("/review");
  if (awarded > 0) revalidatePath("/");

  return { awarded };
}

export async function updateCardAction(formData: FormData) {
  const cardId = formData.get("cardId");
  const title = formData.get("title");
  const description = formData.get("description");
  const priorityId = formData.get("priorityId");
  const dueDate = formData.get("dueDate");

  if (typeof cardId !== "string" || typeof title !== "string" || !title.trim()) {
    return;
  }

  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: true },
  });

  const boardId = card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  const nextPriorityId = typeof priorityId === "string" && priorityId ? priorityId : null;
  if (!(await cardRefsInBoard(prisma, access, { priorityId: nextPriorityId }))) return;

  await prisma.card.update({
    where: { id: cardId },
    data: {
      title: title.trim(),
      description:
        typeof description === "string" && description.trim() ? description.trim() : null,
      priorityId: nextPriorityId,
      dueDate: typeof dueDate === "string" && dueDate ? new Date(dueDate) : null,
    },
  });

  await prisma.activity.create({
    data: {
      boardId,
      cardId,
      userId: user.id,
      type: ActivityType.CARD_UPDATED,
      message: `${user.name ?? user.email} updated card "${title.trim()}"`,
    },
  });

  revalidatePath(`/board/${boardId}`);
}

export async function setCardPriorityAction(formData: FormData) {
  const cardId = formData.get("cardId");
  const priorityId = formData.get("priorityId");

  if (typeof cardId !== "string" || typeof priorityId !== "string") return;

  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: true },
  });

  const boardId = card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  // เมนูมีแถว "ไม่กำหนด" อยู่แล้ว (ส่งค่าว่างมา) กดแถวที่เลือกอยู่จึงควรคงค่าเดิม ไม่ใช่ toggle
  const nextPriorityId = priorityId || null;
  if (!(await cardRefsInBoard(prisma, access, { priorityId: nextPriorityId }))) return;

  await prisma.card.update({
    where: { id: cardId },
    data: { priorityId: nextPriorityId },
  });

  revalidatePath(`/board/${boardId}`);
}

export async function deleteCardAction(formData: FormData) {
  const cardId = formData.get("cardId");
  if (typeof cardId !== "string") return;

  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: true, review: { select: { id: true } } },
  });

  const boardId = card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;
  // บอร์ดในรายวิชา: การ์ดที่อาจารย์ตรวจแล้วลบไม่ได้ ไม่งั้นคะแนนหายจาก CSV ของอาจารย์
  if (access.courseId && card.review) return;

  await prisma.card.delete({ where: { id: cardId } });

  await prisma.activity.create({
    data: {
      boardId,
      userId: user.id,
      type: ActivityType.CARD_DELETED,
      message: `${user.name ?? user.email} deleted card "${card.title}"`,
    },
  });

  revalidatePath(`/board/${boardId}`);
}

export async function createChecklistAction(formData: FormData) {
  const cardId = formData.get("cardId");
  if (typeof cardId !== "string") return;

  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: true },
  });

  const access = await assertBoardAccess(card.list.boardId, user);
  if (!access?.canEdit) return;

  const lastChecklist = await prisma.checklist.findFirst({
    where: { cardId },
    orderBy: { position: "desc" },
  });

  await prisma.checklist.create({
    data: {
      cardId,
      title: "Checklist",
      position: (lastChecklist?.position ?? 0) + 1,
    },
  });

  revalidatePath(`/board/${card.list.boardId}`);
}

export async function addChecklistItemAction(formData: FormData) {
  const checklistId = formData.get("checklistId");
  const content = formData.get("content");

  if (typeof checklistId !== "string" || typeof content !== "string" || !content.trim()) {
    return;
  }

  const user = await getCurrentUser();

  const checklist = await prisma.checklist.findUniqueOrThrow({
    where: { id: checklistId },
    include: { card: { include: { list: true } } },
  });

  const boardId = checklist.card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  const lastItem = await prisma.checklistItem.findFirst({
    where: { checklistId },
    orderBy: { position: "desc" },
  });

  await prisma.checklistItem.create({
    data: {
      checklistId,
      content: content.trim(),
      position: (lastItem?.position ?? 0) + 1,
    },
  });

  revalidatePath(`/board/${boardId}`);
}

export async function toggleChecklistItemAction(formData: FormData) {
  const itemId = formData.get("itemId");
  if (typeof itemId !== "string") return;

  const user = await getCurrentUser();

  const item = await prisma.checklistItem.findUniqueOrThrow({
    where: { id: itemId },
    include: { checklist: { include: { card: { include: { list: true } } } } },
  });

  const boardId = item.checklist.card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  await prisma.checklistItem.update({
    where: { id: itemId },
    data: { isCompleted: !item.isCompleted },
  });

  revalidatePath(`/board/${boardId}`);
}

export async function deleteChecklistItemAction(formData: FormData) {
  const itemId = formData.get("itemId");
  if (typeof itemId !== "string") return;

  const user = await getCurrentUser();

  const item = await prisma.checklistItem.findUniqueOrThrow({
    where: { id: itemId },
    include: { checklist: { include: { card: { include: { list: true } } } } },
  });

  const boardId = item.checklist.card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  await prisma.checklistItem.delete({ where: { id: itemId } });

  revalidatePath(`/board/${boardId}`);
}

export async function createLabelAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const name = formData.get("name");
  const color = formData.get("color");

  if (
    typeof boardId !== "string" ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof color !== "string" ||
    !color
  ) {
    return;
  }

  const user = await getCurrentUser();
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  await prisma.label.create({
    data: { boardId, name: name.trim(), color },
  });

  revalidatePath(`/board/${boardId}`);
}

export async function deleteLabelAction(formData: FormData) {
  const labelId = formData.get("labelId");
  if (typeof labelId !== "string") return;

  const user = await getCurrentUser();

  const label = await prisma.label.findUniqueOrThrow({ where: { id: labelId } });
  const access = await assertBoardAccess(label.boardId, user);
  if (!access?.canEdit) return;

  await prisma.label.delete({ where: { id: labelId } });

  revalidatePath(`/board/${label.boardId}`);
}

export async function createPriorityAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const name = formData.get("name");
  const color = formData.get("color");

  if (
    typeof boardId !== "string" ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof color !== "string" ||
    !color
  ) {
    return;
  }

  const user = await getCurrentUser();
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  const lastPriority = await prisma.priority.findFirst({
    where: { boardId },
    orderBy: { order: "desc" },
  });

  await prisma.priority.create({
    data: {
      boardId,
      name: name.trim(),
      color,
      order: (lastPriority?.order ?? 0) + 1,
    },
  });

  revalidatePath(`/board/${boardId}`);
}

export async function updatePriorityAction(formData: FormData) {
  const priorityId = formData.get("priorityId");
  const name = formData.get("name");
  const color = formData.get("color");

  if (
    typeof priorityId !== "string" ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof color !== "string" ||
    !color
  ) {
    return;
  }

  const user = await getCurrentUser();

  const priority = await prisma.priority.findUniqueOrThrow({ where: { id: priorityId } });
  const access = await assertBoardAccess(priority.boardId, user);
  if (!access?.canEdit) return;

  await prisma.priority.update({
    where: { id: priorityId },
    data: { name: name.trim(), color },
  });

  revalidatePath(`/board/${priority.boardId}`);
}

export async function deletePriorityAction(formData: FormData) {
  const priorityId = formData.get("priorityId");
  if (typeof priorityId !== "string") return;

  const user = await getCurrentUser();

  const priority = await prisma.priority.findUniqueOrThrow({ where: { id: priorityId } });
  const access = await assertBoardAccess(priority.boardId, user);
  if (!access?.canEdit) return;

  await prisma.priority.delete({ where: { id: priorityId } });

  revalidatePath(`/board/${priority.boardId}`);
}

export async function toggleCardLabelAction(formData: FormData) {
  const cardId = formData.get("cardId");
  const labelId = formData.get("labelId");

  if (typeof cardId !== "string" || typeof labelId !== "string") return;

  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: true },
  });

  const boardId = card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  const existing = await prisma.cardLabel.findUnique({
    where: { cardId_labelId: { cardId, labelId } },
  });

  if (existing) {
    await prisma.cardLabel.delete({
      where: { cardId_labelId: { cardId, labelId } },
    });
  } else {
    if (!(await cardRefsInBoard(prisma, access, { labelIds: [labelId] }))) return;
    await prisma.cardLabel.create({ data: { cardId, labelId } });
  }

  revalidatePath(`/board/${boardId}`);
}

export async function toggleCardAssigneeAction(formData: FormData) {
  const cardId = formData.get("cardId");
  const assigneeId = formData.get("userId");

  if (typeof cardId !== "string" || typeof assigneeId !== "string") return;

  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: true },
  });

  const boardId = card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  const existing = await prisma.cardAssignee.findUnique({
    where: { cardId_userId: { cardId, userId: assigneeId } },
  });

  if (existing) {
    await prisma.cardAssignee.delete({
      where: { cardId_userId: { cardId, userId: assigneeId } },
    });
  } else {
    if (!(await cardRefsInBoard(prisma, access, { assigneeIds: [assigneeId] }))) return;
    await prisma.cardAssignee.create({ data: { cardId, userId: assigneeId } });
  }

  revalidatePath(`/board/${boardId}`);
}

export async function createInviteAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const email = formData.get("email");
  const rawRole = formData.get("role");

  if (typeof boardId !== "string" || typeof email !== "string" || !email.trim()) {
    return;
  }

  // ค่าที่ไม่รู้จักตกเป็น EDITOR เท่ากับ default เดิมของ schema
  const role = rawRole === BoardRole.VIEWER ? BoardRole.VIEWER : BoardRole.EDITOR;

  const user = await getCurrentUser();

  const board = await prisma.board.findUniqueOrThrow({ where: { id: boardId } });
  if (board.ownerId !== user.id) return;

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.boardInvite.create({
    data: {
      boardId,
      email: email.trim().toLowerCase(),
      role,
      token,
      status: InviteStatus.PENDING,
      expiresAt,
    },
  });

  await prisma.activity.create({
    data: {
      boardId,
      userId: user.id,
      type: ActivityType.MEMBER_INVITED,
      message: `${user.name ?? user.email} invited ${email.trim()} as ${role}`,
    },
  });

  revalidatePath(`/board/${boardId}`);
}

/**
 * เปิด/ปิดลิงก์แชร์ของบอร์ด และตั้งว่าคนที่เข้ามาทางลิงก์ได้สิทธิ์อะไร — **เจ้าของเท่านั้น**
 * ไม่ใช้ canEdit เพราะการเปิดทางให้คนนอกเข้าบอร์ดเป็นสิทธิ์ระดับเดียวกับการเชิญสมาชิก
 */
export async function updateShareLinkAction(formData: FormData) {
  const boardId = formData.get("boardId");
  if (typeof boardId !== "string") return;

  const enabled = formData.get("enabled") === "1";
  // ค่าที่ไม่รู้จักตกเป็น EDITOR เท่ากับ default เดิมของ schema
  const role = formData.get("role") === BoardRole.VIEWER ? BoardRole.VIEWER : BoardRole.EDITOR;

  const user = await getCurrentUser();

  const board = await prisma.board.findUniqueOrThrow({ where: { id: boardId } });
  if (board.ownerId !== user.id) return;

  await prisma.boardShareLink.upsert({
    where: { boardId },
    update: { enabled, role },
    create: { boardId, token: randomUUID(), enabled, role },
  });

  revalidatePath(`/board/${boardId}`);
}

/** สุ่ม token ใหม่ = ลิงก์เดิมที่ส่งออกไปแล้วใช้ไม่ได้ทันที — **เจ้าของเท่านั้น** */
export async function regenerateShareLinkAction(formData: FormData) {
  const boardId = formData.get("boardId");
  if (typeof boardId !== "string") return;

  const user = await getCurrentUser();

  const board = await prisma.board.findUniqueOrThrow({ where: { id: boardId } });
  if (board.ownerId !== user.id) return;

  const link = await prisma.boardShareLink.findUnique({ where: { boardId } });
  if (!link) return;

  await prisma.boardShareLink.update({
    where: { boardId },
    data: { token: randomUUID() },
  });

  revalidatePath(`/board/${boardId}`);
}

/** เปลี่ยนสิทธิ์สมาชิก EDITOR ↔ VIEWER — **เจ้าของเท่านั้น** (ระดับเดียวกับการเชิญ) */
export async function setMemberRoleAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const memberId = formData.get("userId");
  const rawRole = formData.get("role");
  if (typeof boardId !== "string" || typeof memberId !== "string") return;
  // ไม่รับค่าอื่นเลย (ต่างจากตอนเชิญที่ค่าแปลก ๆ ตกเป็น EDITOR) — นี่คือการแก้สิทธิ์ ต้องตั้งใจ
  if (rawRole !== BoardRole.EDITOR && rawRole !== BoardRole.VIEWER) return;

  const user = await getCurrentUser();

  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  if (board?.ownerId !== user.id) return;

  await prisma.boardMember.updateMany({
    where: { boardId, userId: memberId },
    data: { role: rawRole },
  });

  revalidatePath(`/board/${boardId}`);
}

/** เอาสมาชิกออกจากบอร์ด — **เจ้าของเท่านั้น** เจ้าของเองไม่มีแถวใน BoardMember จึงเอาออกไม่ได้อยู่แล้ว */
export async function removeMemberAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const memberId = formData.get("userId");
  if (typeof boardId !== "string" || typeof memberId !== "string") return;

  const user = await getCurrentUser();

  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  if (board?.ownerId !== user.id || memberId === board.ownerId) return;

  await removeMembership(boardId, memberId);

  revalidatePath(`/board/${boardId}`);
}

/** สมาชิกออกจากบอร์ดเอง แล้วพากลับหน้าแรก (เปิดบอร์ดนี้ต่อไม่ได้แล้ว) */
export async function leaveBoardAction(formData: FormData) {
  const boardId = formData.get("boardId");
  if (typeof boardId !== "string") return;

  const user = await getCurrentUser();

  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
  });
  if (!membership) return;

  await removeMembership(boardId, user.id);

  // sidebar อยู่ใน layout — ต้อง revalidate ทั้ง layout ไม่งั้นบอร์ดยังค้างในรายการ "แชร์กับฉัน"
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * ลบสมาชิกพร้อมการมอบหมายงานของเขาในบอร์ดนี้ — ไม่งั้นการ์ดจะโชว์ผู้รับผิดชอบ
 * ที่เปิดบอร์ดไม่ได้แล้ว (ลิงก์แชร์ที่ยังเปิดอยู่ยังพาเขากลับเข้ามาได้ ถ้าเจ้าของไม่ปิด)
 */
async function removeMembership(boardId: string, userId: string) {
  await prisma.$transaction([
    prisma.cardAssignee.deleteMany({ where: { userId, card: { list: { boardId } } } }),
    prisma.boardMember.deleteMany({ where: { boardId, userId } }),
  ]);
}

/** การ์ด + boardId + สิทธิ์ ในการเรียกครั้งเดียว — ทุก action ของไฟล์แนบต้องผ่านด่านนี้ */
async function cardEditAccess(cardId: string, user: Parameters<typeof assertBoardAccess>[1]) {
  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: { select: { boardId: true } } },
  });

  const access = await assertBoardAccess(card.list.boardId, user);
  if (!access?.canEdit) return null;

  return { boardId: card.list.boardId };
}

/** แนบลิงก์ (ไม่ต้องใช้ Blob) — URL ผ่าน sanitizeAttachmentUrl ก่อนเสมอ */
export async function addLinkAttachmentAction(formData: FormData) {
  const cardId = formData.get("cardId");
  const rawUrl = formData.get("url");
  if (typeof cardId !== "string" || typeof rawUrl !== "string") return;

  const url = sanitizeAttachmentUrl(rawUrl);
  if (!url) return;

  const user = await getCurrentUser();
  const context = await cardEditAccess(cardId, user);
  if (!context) return;

  const name = optionalText(formData.get("name")) ?? attachmentNameFromUrl(url);

  await prisma.attachment.create({
    data: { cardId, type: "LINK", name, url, uploadedById: user.id },
  });

  revalidatePath(`/board/${context.boardId}`);
}

/**
 * อัปโหลดไฟล์ขึ้น Vercel Blob — ต้องมี BLOB_READ_WRITE_TOKEN ถึงจะทำงาน
 * เพดานขนาดเช็คซ้ำที่นี่ด้วย เพราะด่านฝั่ง client ถูกข้ามได้เสมอ
 */
export async function uploadAttachmentAction(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const cardId = formData.get("cardId");
  const file = formData.get("file");
  const attachmentId = formData.get("attachmentId");
  if (typeof cardId !== "string" || !(file instanceof File) || !z.uuid().safeParse(attachmentId).success)
    return { ok: false, error: "ไฟล์ไม่ถูกต้อง" };
  if (!isWithinAttachmentSizeLimit(file.size))
    return { ok: false, error: `ไฟล์ต้องมีข้อมูลและมีขนาดไม่เกิน ${formatFileSize(MAX_ATTACHMENT_BYTES)}` };
  const user = await getCurrentUser();
  let blob: Awaited<ReturnType<typeof put>> | undefined;
  let saved = false;
  try {
    const context = await cardEditAccess(cardId, user);
    if (!context) return { ok: false, error: "ไม่มีสิทธิ์แก้ไขการ์ดนี้" };
    const existing = await prisma.attachment.findUnique({ where: { id: attachmentId as string } });
    if (existing) {
      if (existing.cardId !== cardId || existing.uploadedById !== user.id)
        return { ok: false, error: "คำขอแนบไฟล์ไม่ถูกต้อง" };
      revalidatePath(`/board/${context.boardId}`);
      return { ok: true };
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      return { ok: false, error: "ระบบยังไม่ได้ตั้งค่าที่เก็บไฟล์" };
    blob = await put(`cards/${cardId}/${file.name}`, file, { access: "public", addRandomSuffix: true });
    await prisma.attachment.create({ data: {
      id: attachmentId as string, cardId, type: attachmentKindForUpload(file.name, file.type),
      name: file.name, url: blob.url, size: file.size, mimeType: file.type || null,
      blobPathname: blob.pathname, uploadedById: user.id,
    } });
    saved = true;
    revalidatePath(`/board/${context.boardId}`);
    return { ok: true };
  } catch {
    if (blob && !saved) {
      // A database timeout can arrive after commit. Never remove a blob that a saved row references.
      try {
        const stored = await prisma.attachment.findUnique({ where: { id: attachmentId as string } });
        if (stored?.blobPathname !== blob.pathname) await del(blob.pathname);
      } catch { console.error("Could not verify or clean up failed attachment upload"); }
    }
    return { ok: false, error: "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

/** ลบไฟล์ออกจาก Blob ก่อนลบแถว ไม่งั้นไฟล์จะค้างกินโควตาโดยไม่มีใครรู้ */
export async function deleteAttachmentAction(formData: FormData) {
  const attachmentId = formData.get("attachmentId");
  if (typeof attachmentId !== "string") return;

  const user = await getCurrentUser();

  const attachment = await prisma.attachment.findUniqueOrThrow({
    where: { id: attachmentId },
  });

  const context = await cardEditAccess(attachment.cardId, user);
  if (!context) return;

  if (attachment.blobPathname && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(attachment.blobPathname);
  }

  await prisma.attachment.delete({ where: { id: attachmentId } });

  revalidatePath(`/board/${context.boardId}`);
}

export async function addCommentAction(formData: FormData) {
  const cardId = formData.get("cardId");
  const content = formData.get("content");

  if (typeof cardId !== "string" || typeof content !== "string" || !content.trim()) {
    return;
  }

  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: true },
  });

  const boardId = card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canEdit) return;

  await prisma.comment.create({
    data: {
      cardId,
      userId: user.id,
      content: content.trim(),
    },
  });

  await prisma.activity.create({
    data: {
      boardId,
      cardId,
      userId: user.id,
      type: ActivityType.COMMENT_ADDED,
      message: `${user.name ?? user.email} commented on "${card.title}"`,
    },
  });

  revalidatePath(`/board/${boardId}`);
}

/**
 * ตั้ง/ยกเลิกคอลัมน์ "เสร็จสิ้น" ของบอร์ด — บอร์ดละ 1 คอลัมน์ (ล้างของเดิมก่อนเสมอ)
 * การ์ดที่อยู่ในคอลัมน์นั้นตอนตั้งธงจะถือว่าเสร็จทันที แต่ไม่ย้อนให้แต้ม เพราะไม่รู้ว่าใครเป็นคนทำ
 */
export async function setDoneListAction(formData: FormData) {
  const listId = formData.get("listId");
  if (typeof listId !== "string") return;

  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  const access = await assertBoardAccess(list.boardId, user);
  if (!access?.canEdit) return;

  await prisma.$transaction(async (tx) => {
    if (list.isDoneList) {
      await clearDoneList(tx, list.boardId);
    } else {
      await flagDoneList(tx, list.boardId, listId);
    }
  });

  revalidatePath(`/board/${list.boardId}`);
  revalidatePath("/");
}

/**
 * ตั้ง/ยกเลิกคอลัมน์ "กำลังตรวจสอบ" — บอร์ดละ 1 คอลัมน์ และต้องไม่ใช่คอลัมน์เสร็จสิ้น
 * บอร์ดที่มีคอลัมน์นี้ การ์ดจะเข้าคอลัมน์เสร็จสิ้นได้ก็ต่อเมื่ออาจารย์อนุมัติ (ดู needsTeacherApproval)
 */
export async function setReviewListAction(formData: FormData) {
  const listId = formData.get("listId");
  if (typeof listId !== "string") return;

  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  const access = await assertBoardAccess(list.boardId, user);
  if (!access?.canEdit) return;
  if (list.isDoneList) return;

  await prisma.$transaction(async (tx) => {
    await tx.list.updateMany({
      where: { boardId: list.boardId, isReviewList: true },
      data: { isReviewList: false },
    });
    if (!list.isReviewList) {
      await tx.list.update({ where: { id: listId }, data: { isReviewList: true } });
    }
  });

  revalidatePath(`/board/${list.boardId}`);
  revalidatePath("/review");
}

/**
 * ย้ายธงคอลัมน์เสร็จสิ้นไปคอลัมน์นี้ แล้วดันมันไปขวาสุด
 * การ์ดที่อยู่ในคอลัมน์นั้นอยู่แล้วถือว่าเสร็จทันที แต่ไม่ย้อนให้แต้ม เพราะไม่รู้ว่าใครเป็นคนทำ
 * และไม่เซ็ต completedAt ด้วย ไม่งั้นลากออกแล้วการ์ดจะขึ้นชิป "ได้แต้มแล้ว" ทั้งที่ไม่เคยได้
 */
async function flagDoneList(tx: Prisma.TransactionClient, boardId: string, listId: string) {
  await clearDoneList(tx, boardId);

  const last = await tx.list.findFirst({
    where: { boardId, id: { not: listId } },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await tx.list.update({
    where: { id: listId },
    // คอลัมน์เดียวเป็นทั้งคอลัมน์ตรวจและคอลัมน์เสร็จสิ้นไม่ได้
    data: {
      isDoneList: true,
      isReviewList: false,
      position: positionBetween(last?.position, undefined),
    },
  });
  await tx.card.updateMany({
    where: { listId, isCompleted: false },
    data: { isCompleted: true },
  });
}

/**
 * ยกเลิกคอลัมน์เสร็จสิ้นเดิม — ต้องคืนการ์ดในคอลัมน์นั้นเป็น "กำลังทำ" ด้วย
 * ไม่งั้นการ์ดจะค้างสถานะเสร็จอยู่ในคอลัมน์ที่ไม่ใช่คอลัมน์เสร็จสิ้นแล้ว
 */
async function clearDoneList(tx: Prisma.TransactionClient, boardId: string) {
  const previousDoneLists = await tx.list.findMany({
    where: { boardId, isDoneList: true },
    select: { id: true },
  });
  if (previousDoneLists.length === 0) return;

  await tx.list.updateMany({
    where: { boardId },
    data: { isDoneList: false },
  });
  await tx.card.updateMany({
    where: {
      listId: { in: previousDoneLists.map((previous) => previous.id) },
      isCompleted: true,
    },
    data: { isCompleted: false },
  });
}

const REVIEW_REQUIRED_ERROR = "บอร์ดนี้ต้องให้อาจารย์ตรวจก่อน การ์ดถึงจะเข้าคอลัมน์เสร็จสิ้นได้";

/**
 * บอร์ดที่ผูกรายวิชาและมีคอลัมน์ตรวจ (`access.requiresApproval`): มีแค่อาจารย์ของวิชานั้น
 * ที่พาการ์ด "เข้า" คอลัมน์เสร็จสิ้นได้ (ผ่านหน้าตรวจงาน) จัดลำดับภายในคอลัมน์เสร็จสิ้นเองยังได้
 * บอร์ดส่วนตัวทำงานแบบเดิม — ไม่มีอาจารย์เห็น ถ้าบังคับด่านนี้การ์ดจะค้างตลอดไป
 */
function needsTeacherApproval(
  access: BoardAccess,
  targetList: { isDoneList: boolean },
  listChanged: boolean
) {
  if (!targetList.isDoneList || !listChanged || access.canReview) return false;
  return access.requiresApproval;
}

/** เข้าคอลัมน์ตรวจ = ส่งงาน — จำไว้ว่าใครส่ง แต้มตอนอาจารย์อนุมัติจะไปที่คนนี้ */
function submissionFields(
  targetList: { isReviewList: boolean },
  listChanged: boolean,
  userId: string
) {
  return targetList.isReviewList && listChanged
    ? { submittedById: userId, submittedAt: new Date() }
    : {};
}

export type LinkCourseState = { error?: string } | undefined;

/**
 * ผูกบอร์ดเข้ารายวิชาด้วยรหัสเข้าร่วม — **เจ้าของบอร์ดเท่านั้น** และผูกได้ครั้งเดียว
 * การถอนออกเป็นสิทธิ์ของอาจารย์ (unlinkBoardAction ใน courses/actions.ts) ไม่งั้นนักศึกษา
 * ถอนบอร์ดออกแล้วลบทิ้งเพื่อลบคะแนนที่ไม่ชอบได้
 */
export async function linkBoardToCourseAction(
  _state: LinkCourseState,
  formData: FormData
): Promise<LinkCourseState> {
  const boardId = formData.get("boardId");
  const rawCode = formData.get("joinCode");
  if (typeof boardId !== "string" || typeof rawCode !== "string" || !rawCode.trim()) {
    return { error: "กรอกรหัสรายวิชา" };
  }

  const user = await getCurrentUser();

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, courseId: true },
  });
  if (board?.ownerId !== user.id) return { error: "เฉพาะเจ้าของบอร์ดเท่านั้นที่ผูกรายวิชาได้" };
  if (board.courseId) return { error: "บอร์ดนี้อยู่ในรายวิชาแล้ว" };

  const course = await prisma.course.findUnique({
    where: { joinCode: normalizeJoinCode(rawCode) },
    select: { id: true },
  });
  if (!course) return { error: "ไม่พบรายวิชานี้ ตรวจรหัสอีกครั้ง" };

  await prisma.$transaction(async (tx) => {
    // updateMany + เงื่อนไข courseId: null = กันกดผูกพร้อมกันสองแท็บแล้วได้วิชาที่สองทับ
    const linked = await tx.board.updateMany({
      where: { id: boardId, courseId: null },
      data: { courseId: course.id },
    });
    if (linked.count === 0) return;

    // อาจารย์ต้องมีคอลัมน์ตรวจให้ดูและคอลัมน์เสร็จสิ้นให้อนุมัติเข้า — บอร์ดเก่าอาจยังไม่มี
    const lists = await tx.list.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
      select: { id: true, position: true, isDoneList: true, isReviewList: true },
    });
    if (!lists.some((list) => list.isDoneList)) {
      const done = await tx.list.create({
        data: {
          boardId,
          name: "เสร็จสิ้น",
          isDoneList: true,
          position: positionBetween(lists[lists.length - 1]?.position, undefined),
        },
        select: { id: true, position: true, isDoneList: true, isReviewList: true },
      });
      lists.push(done);
    }
    if (!lists.some((list) => list.isReviewList)) {
      await tx.list.create({
        data: { boardId, name: "กำลังตรวจสอบ", isReviewList: true, position: insertListPosition(lists) },
      });
    }
  });

  revalidatePath(`/board/${boardId}`);
  revalidatePath("/review");
  return undefined;
}
