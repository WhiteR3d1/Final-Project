"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { assertBoardAccess } from "@/lib/board-access";
import { ActivityType, InviteStatus } from "@/app/generated/prisma/enums";

export async function createListAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const name = formData.get("name");

  if (typeof boardId !== "string" || typeof name !== "string" || !name.trim()) {
    return;
  }

  const user = await getCurrentUser();
  const access = await assertBoardAccess(boardId, user.id);
  if (!access) return;

  const lastList = await prisma.list.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
  });

  await prisma.list.create({
    data: {
      boardId,
      name: name.trim(),
      position: (lastList?.position ?? 0) + 1,
    },
  });

  revalidatePath(`/board/${boardId}`);
}

export async function renameListAction(listId: string, name: string) {
  if (!name.trim()) return;

  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  const access = await assertBoardAccess(list.boardId, user.id);
  if (!access) return;

  await prisma.list.update({
    where: { id: listId },
    data: { name: name.trim() },
  });

  revalidatePath(`/board/${list.boardId}`);
}

export async function deleteListAction(formData: FormData) {
  const listId = formData.get("listId");
  if (typeof listId !== "string") return;

  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  const access = await assertBoardAccess(list.boardId, user.id);
  if (!access) return;

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
  if (!access) return;

  await prisma.list.update({
    where: { id: listId },
    data: { position: newPosition },
  });

  revalidatePath(`/board/${list.boardId}`);
}

export async function createCardAction(formData: FormData) {
  const listId = formData.get("listId");
  const title = formData.get("title");

  if (typeof listId !== "string" || typeof title !== "string" || !title.trim()) {
    return;
  }

  const user = await getCurrentUser();

  const list = await prisma.list.findUniqueOrThrow({
    where: { id: listId },
    select: { boardId: true },
  });

  const access = await assertBoardAccess(list.boardId, user.id);
  if (!access) return;

  const lastCard = await prisma.card.findFirst({
    where: { listId },
    orderBy: { position: "desc" },
  });

  const card = await prisma.card.create({
    data: {
      listId,
      title: title.trim(),
      position: (lastCard?.position ?? 0) + 1,
      createdById: user.id,
    },
  });

  await prisma.activity.create({
    data: {
      boardId: list.boardId,
      cardId: card.id,
      userId: user.id,
      type: ActivityType.CARD_CREATED,
      message: `${user.name ?? user.email} created card "${card.title}"`,
    },
  });

  revalidatePath(`/board/${list.boardId}`);
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
  if (!access) return;

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

  revalidatePath(`/board/${card.list.boardId}`);
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
  if (!access) return;

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

  revalidatePath(`/board/${card.list.boardId}`);
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
  if (!access) return;

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
  if (!access) return;

  const nextPriorityId = card.priorityId === priorityId ? null : priorityId;

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
  if (!access) return;

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
  if (!access) return;

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
  if (!access) return;

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
  if (!access) return;

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
  if (!access) return;

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
  if (!access) return;

  await prisma.label.create({
    data: { boardId, name: name.trim(), color },
  });

  revalidatePath(`/board/${boardId}`);
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
  if (!access) return;

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
  if (!access) return;

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
  if (!access) return;

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
  if (!access) return;

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
  if (!access) return;

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

  if (typeof boardId !== "string" || typeof email !== "string" || !email.trim()) {
    return;
  }

  const user = await getCurrentUser();

  const board = await prisma.board.findUniqueOrThrow({ where: { id: boardId } });
  if (board.ownerId !== user.id) return;

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.boardInvite.create({
    data: {
      boardId,
      email: email.trim().toLowerCase(),
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
      message: `${user.name ?? user.email} invited ${email.trim()}`,
    },
  });

  revalidatePath(`/board/${boardId}`);
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
  if (!access) return;

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
