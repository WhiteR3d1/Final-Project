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

type BoardRow = Prisma.BoardGetPayload<{
  include: {
    owner: { select: { name: true; email: true } };
    _count: { select: { members: true } };
    lists: { select: { id: true } };
  };
}>;

type CardTally = { total: number; done: number };

function toSummary(
  board: BoardRow,
  userId: string,
  tallyByList: Map<string, CardTally>
): BoardSummary {
  let totalCards = 0;
  let doneCards = 0;
  for (const list of board.lists) {
    // คอลัมน์ที่ไม่มีการ์ดเลยจะไม่มีแถวใน groupBy — นับเป็น 0
    const tally = tallyByList.get(list.id);
    if (!tally) continue;
    totalCards += tally.total;
    doneCards += tally.done;
  }

  return {
    id: board.id,
    name: board.name,
    color: board.color,
    ownerName: board.owner.name ?? board.owner.email,
    isOwner: board.ownerId === userId,
    memberCount: board._count.members,
    totalCards,
    doneCards,
    progress: totalCards > 0 ? (doneCards / totalCards) * 100 : 0,
    updatedAt: board.updatedAt,
  };
}

/**
 * บอร์ดทั้งหมดของผู้ใช้ พร้อมความคืบหน้า — cache() ทำให้ sidebar กับหน้าเพจใช้ query เดียวกัน
 *
 * ให้ฐานข้อมูลนับการ์ดให้ผ่าน groupBy แทนการดึงการ์ดทุกใบมานับใน JS
 * ข้อมูลที่วิ่งข้าม network จึงเป็น O(คอลัมน์) ไม่ใช่ O(การ์ด) — sidebar เรียกฟังก์ชันนี้ทุกหน้า
 */
export const getUserBoards = cache(async (userId: string) => {
  const where = accessibleBoardWhere(userId);

  const [boards, cardCounts] = await Promise.all([
    prisma.board.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { members: true } },
        lists: { select: { id: true } },
      },
    }),
    prisma.card.groupBy({
      by: ["listId", "isCompleted"],
      where: { list: { board: where } },
      _count: { _all: true },
    }),
  ]);

  const tallyByList = new Map<string, CardTally>();
  for (const row of cardCounts) {
    const tally = tallyByList.get(row.listId) ?? { total: 0, done: 0 };
    tally.total += row._count._all;
    if (row.isCompleted) tally.done += row._count._all;
    tallyByList.set(row.listId, tally);
  }

  const summaries = boards.map((board) => toSummary(board, userId, tallyByList));

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
