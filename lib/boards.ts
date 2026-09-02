import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * เงื่อนไข "บอร์ดที่ผู้ใช้คนนี้เข้าถึงได้" (เจ้าของ หรือ สมาชิก)
 * ใช้ร่วมกันทุกที่ที่ query ข้ามบอร์ด เพื่อไม่ให้มีเงื่อนไขสิทธิ์เขียนซ้ำหลายที่แล้วหลุด
 */
export function accessibleBoardWhere(userId: string): Prisma.BoardWhereInput {
  return { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
}

export type BoardSummary = {
  id: string;
  name: string;
  color: string | null;
  ownerName: string | null;
  isOwner: boolean;
  memberCount: number;
  totalCards: number;
  doneCards: number;
  progress: number;
  updatedAt: Date;
};

function toSummary(
  board: Prisma.BoardGetPayload<{
    include: {
      owner: { select: { name: true; email: true } };
      _count: { select: { members: true } };
      lists: { select: { cards: { select: { isCompleted: true } } } };
    };
  }>,
  userId: string
): BoardSummary {
  const cards = board.lists.flatMap((list) => list.cards);
  const doneCards = cards.filter((card) => card.isCompleted).length;

  return {
    id: board.id,
    name: board.name,
    color: board.color,
    ownerName: board.owner.name ?? board.owner.email,
    isOwner: board.ownerId === userId,
    memberCount: board._count.members,
    totalCards: cards.length,
    doneCards,
    progress: cards.length > 0 ? (doneCards / cards.length) * 100 : 0,
    updatedAt: board.updatedAt,
  };
}

/** บอร์ดทั้งหมดของผู้ใช้ พร้อมความคืบหน้า — cache() ทำให้ sidebar กับหน้าเพจใช้ query เดียวกัน */
export const getUserBoards = cache(async (userId: string) => {
  const boards = await prisma.board.findMany({
    where: accessibleBoardWhere(userId),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { name: true, email: true } },
      _count: { select: { members: true } },
      lists: { select: { cards: { select: { isCompleted: true } } } },
    },
  });

  const summaries = boards.map((board) => toSummary(board, userId));

  return {
    all: summaries,
    owned: summaries.filter((board) => board.isOwner),
    shared: summaries.filter((board) => !board.isOwner),
  };
});

/** สีประจำบอร์ดเวลาไม่ได้ตั้งค่าไว้ — ให้คงที่ตาม id จะได้ไม่สลับสีทุกครั้งที่โหลด */
const FALLBACK_COLORS = ["#8b7cff", "#4dabff", "#2fd4a0", "#ffcc4d", "#ff8f6b"];

export function boardColor(board: { id: string; color: string | null }) {
  if (board.color) return board.color;
  let hash = 0;
  for (const char of board.id) hash = (hash + char.charCodeAt(0)) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[hash];
}
