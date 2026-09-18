"use server";

import { parseCardCreate } from "@/lib/card-create";
import { z } from "zod";
import { randomUUID } from "crypto";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { assertBoardAccess } from "@/lib/board-access";
import { ActivityType, BoardRole, InviteStatus } from "@/app/generated/prisma/enums";
import { awardCardCompletion } from "@/lib/gamification";
import {
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
  attachmentKindForUpload,
  attachmentNameFromUrl,
  isWithinAttachmentSizeLimit,
  sanitizeAttachmentUrl,
} from "@/lib/attachments";

type CardForCompletion = {
  id: string;
  title: string;
  isCompleted: boolean;
  completedAt: Date | null;
  dueDate: Date | null;
};

/**
 * ซิงก์สถานะ "เสร็จ" ของการ์ดกับคอลัมน์ที่มันไปอยู่ แล้วคืนแต้มที่เพิ่งได้ (0 = ไม่ได้แต้มใหม่)
 *
 * ลากออกจากคอลัมน์เสร็จสิ้นได้ตามปกติ — การ์ดกลับเป็น "กำลังทำ" แต่ completedAt กับ PointEvent
 * ยังอยู่ครบ แต้มที่ได้ไปแล้วจึงไม่ถูกริบ และการลากกลับเข้าไปใหม่ก็ไม่ได้แต้มซ้ำ
 */
async function syncCardCompletion(
  card: CardForCompletion,
  targetList: { isDoneList: boolean },
  boardId: string,
  user: { id: string; name: string | null; email: string }
): Promise<number> {
  if (targetList.isDoneList && !card.isCompleted) {
    const completedAt = card.completedAt ?? new Date();

    const awarded = await prisma.$transaction(async (tx) => {
      await tx.card.update({
        where: { id: card.id },
        data: { isCompleted: true, completedAt },
      });

      return awardCardCompletion(tx, {
        userId: user.id,
        boardId,
        card: { id: card.id, dueDate: card.dueDate, completedAt: card.completedAt },
        completedAt,
      });
    });

    await prisma.activity.create({
      data: {
        boardId,
        cardId: card.id,
        userId: user.id,
        type: ActivityType.CARD_COMPLETED,
        message: `${user.name ?? user.email} completed "${card.title}"${
          awarded > 0 ? ` (+${awarded} points)` : ""
        }`,
      },
    });

    return awarded;
  }

  if (!targetList.isDoneList && card.isCompleted) {
    await prisma.card.update({
      where: { id: card.id },
      data: { isCompleted: false },
    });
  }

  return 0;
}

/** ค่าจาก FormData เป็น unknown เสมอ — ตัวช่วยอ่านช่องที่ปล่อยว่างได้ให้เป็น null */
function optionalText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function createListAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const name = formData.get("name");

  if (typeof boardId !== "string" || typeof name !== "string" || !name.trim()) {
    return;
  }

  const user = await getCurrentUser();
  const access = await assertBoardAccess(boardId, user.id);
  if (!access?.canEdit) return;

  const lastList = await prisma.list.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
  });

  await prisma.list.create({
    data: {
      boardId,
      name: name.trim(),
      color: optionalText(formData.get("color")),
      description: optionalText(formData.get("description")),
      position: (lastList?.position ?? 0) + 1,
    },
  });

  revalidatePath(`/board/${boardId}`);
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
  const access = await assertBoardAccess(list.boardId, user.id);
  if (!access?.canEdit) return;

  await prisma.list.update({
    where: { id: listId },
    data: {
      name: name.trim(),
      color: optionalText(formData.get("color")),
      description: optionalText(formData.get("description")),
    },
  });

  revalidatePath(`/board/${list.boardId}`);
}

export async function deleteListAction(formData: FormData) {
  const listId = formData.get("listId");
  if (typeof listId !== "string") return;

  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  const access = await assertBoardAccess(list.boardId, user.id);
  if (!access?.canEdit) return;

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
  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  const access = await assertBoardAccess(list.boardId, user.id);
  if (!access?.canEdit) return;

  await prisma.list.update({
    where: { id: listId },
    data: { position: newPosition },
  });

  revalidatePath(`/board/${list.boardId}`);
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
  const access = await assertBoardAccess(list.boardId, user.id);
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
      const priority = input.priorityId ? await tx.priority.findFirst({ where: { id: input.priorityId, boardId: list.boardId } }) : null;
      const labels = await tx.label.findMany({ where: { id: { in: input.labelIds }, boardId: list.boardId } });
      const members = await tx.boardMember.findMany({ where: { boardId: list.boardId, userId: { in: input.assigneeIds } }, select: { userId: true } });
      const memberIds = new Set([access.ownerId, ...members.map((member) => member.userId)]);
      if ((input.priorityId && !priority) || labels.length !== input.labelIds.length || input.assigneeIds.some((id) => !memberIds.has(id)))
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

export async function moveCardAction(cardId: string, direction: "left" | "right") {
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

  const access = await assertBoardAccess(card.list.boardId, user.id);
  if (!access?.canEdit) return;

  const lists = card.list.board.lists;
  const currentIndex = lists.findIndex((l) => l.id === card.listId);
  const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= lists.length) return;

  const targetList = lists[targetIndex];

  const lastCardInTarget = await prisma.card.findFirst({
    where: { listId: targetList.id },
    orderBy: { position: "desc" },
  });

  await prisma.card.update({
    where: { id: cardId },
    data: {
      listId: targetList.id,
      position: (lastCardInTarget?.position ?? 0) + 1,
    },
  });

  await prisma.activity.create({
    data: {
      boardId: card.list.boardId,
      cardId: card.id,
      userId: user.id,
      type: ActivityType.CARD_MOVED,
      message: `${user.name ?? user.email} moved "${card.title}" to ${targetList.name}`,
      data: { fromListId: card.listId, toListId: targetList.id },
    },
  });

  const awarded = await syncCardCompletion(card, targetList, card.list.boardId, user);

  revalidatePath(`/board/${card.list.boardId}`);
  if (awarded > 0) revalidatePath("/");

  return { awarded };
}

export async function reorderCardAction(
  cardId: string,
  targetListId: string,
  newPosition: number
) {
  const user = await getCurrentUser();

  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: true },
  });

  const access = await assertBoardAccess(card.list.boardId, user.id);
  if (!access?.canEdit) return;

  const targetList = await prisma.list.findUniqueOrThrow({
    where: { id: targetListId },
  });

  if (targetList.boardId !== card.list.boardId) return;

  const listChanged = targetListId !== card.listId;

  await prisma.card.update({
    where: { id: cardId },
    data: { listId: targetListId, position: newPosition },
  });

  if (listChanged) {
    await prisma.activity.create({
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

  const awarded = await syncCardCompletion(card, targetList, card.list.boardId, user);

  revalidatePath(`/board/${card.list.boardId}`);
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
  const access = await assertBoardAccess(boardId, user.id);
  if (!access?.canEdit) return;

  await prisma.card.update({
    where: { id: cardId },
    data: {
      title: title.trim(),
      description:
        typeof description === "string" && description.trim() ? description.trim() : null,
      priorityId: typeof priorityId === "string" && priorityId ? priorityId : null,
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
  const access = await assertBoardAccess(boardId, user.id);
  if (!access?.canEdit) return;

  // เมนูมีแถว "ไม่กำหนด" อยู่แล้ว (ส่งค่าว่างมา) กดแถวที่เลือกอยู่จึงควรคงค่าเดิม ไม่ใช่ toggle
  const nextPriorityId = priorityId || null;

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
    include: { list: true },
  });

  const boardId = card.list.boardId;
  const access = await assertBoardAccess(boardId, user.id);
  if (!access?.canEdit) return;

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

  const access = await assertBoardAccess(card.list.boardId, user.id);
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
  const access = await assertBoardAccess(boardId, user.id);
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
  const access = await assertBoardAccess(boardId, user.id);
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
  const access = await assertBoardAccess(boardId, user.id);
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
  const access = await assertBoardAccess(boardId, user.id);
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
  const access = await assertBoardAccess(label.boardId, user.id);
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
  const access = await assertBoardAccess(boardId, user.id);
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
  const access = await assertBoardAccess(priority.boardId, user.id);
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
  const access = await assertBoardAccess(priority.boardId, user.id);
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
  const access = await assertBoardAccess(boardId, user.id);
  if (!access?.canEdit) return;

  const existing = await prisma.cardLabel.findUnique({
    where: { cardId_labelId: { cardId, labelId } },
  });

  if (existing) {
    await prisma.cardLabel.delete({
      where: { cardId_labelId: { cardId, labelId } },
    });
  } else {
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
  const access = await assertBoardAccess(boardId, user.id);
  if (!access?.canEdit) return;

  const existing = await prisma.cardAssignee.findUnique({
    where: { cardId_userId: { cardId, userId: assigneeId } },
  });

  if (existing) {
    await prisma.cardAssignee.delete({
      where: { cardId_userId: { cardId, userId: assigneeId } },
    });
  } else {
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

/** การ์ด + boardId + สิทธิ์ ในการเรียกครั้งเดียว — ทุก action ของไฟล์แนบต้องผ่านด่านนี้ */
async function cardEditAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { list: { select: { boardId: true } } },
  });

  const access = await assertBoardAccess(card.list.boardId, userId);
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
  const context = await cardEditAccess(cardId, user.id);
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
    const context = await cardEditAccess(cardId, user.id);
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

  const context = await cardEditAccess(attachment.cardId, user.id);
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
  const access = await assertBoardAccess(boardId, user.id);
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
  const access = await assertBoardAccess(list.boardId, user.id);
  if (!access?.canEdit) return;

  const nextValue = !list.isDoneList;

  await prisma.$transaction(async (tx) => {
    // ย้ายธงไปคอลัมน์อื่น (หรือยกเลิก) ต้องคืนการ์ดในคอลัมน์เดิมเป็น "กำลังทำ" ด้วย
    // ไม่งั้นการ์ดจะค้างสถานะเสร็จอยู่ในคอลัมน์ที่ไม่ใช่คอลัมน์เสร็จสิ้นแล้ว
    const previousDoneLists = await tx.list.findMany({
      where: { boardId: list.boardId, isDoneList: true },
      select: { id: true },
    });

    if (previousDoneLists.length > 0) {
      await tx.list.updateMany({
        where: { boardId: list.boardId },
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

    if (nextValue) {
      await tx.list.update({ where: { id: listId }, data: { isDoneList: true } });
      await tx.card.updateMany({
        where: { listId, isCompleted: false },
        data: { isCompleted: true },
      });
    }
  });

  revalidatePath(`/board/${list.boardId}`);
  revalidatePath("/");
}
