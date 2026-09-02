import "server-only";
import { prisma } from "./prisma";
import { PointEventType } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import { dateKey, isOnTime } from "./due";
import { POINTS, levelFromPoints, streakFromDayKeys } from "./points";

/**
 * กติกาแต้มทั้งหมดอยู่ที่ lib/points.ts (คณิตศาสตร์ล้วน เขียนเทสต์ครอบได้)
 * ไฟล์นี้รับหน้าที่เฉพาะส่วนที่อ่าน/เขียน ledger `PointEvent` แล้ว re-export ต่อ
 * เพื่อให้ call site เดิม import จากที่เดียวเหมือนเดิม
 *
 * ตาราง PointEvent เป็นแหล่งความจริงเดียว (ไม่มี cache ยอดรวม) และมี unique([cardId, type])
 * ทำให้การ์ดหนึ่งใบให้แต้มแต่ละชนิดได้ครั้งเดียวตลอดชีพ — ลากเข้า/ออกคอลัมน์ "เสร็จสิ้น"
 * กี่รอบก็ฟาร์มแต้มไม่ได้ และเราจึงไม่ต้องล็อกการ์ดที่เสร็จแล้วไม่ให้ลาก
 */
export { POINTS, levelFromPoints };

type CardForAward = {
  id: string;
  dueDate: Date | null;
  completedAt: Date | null;
};

/**
 * บันทึกแต้มของการทำการ์ดเสร็จ คืนค่าแต้มที่ "เพิ่งได้จริง" (0 = การ์ดใบนี้เคยได้แต้มไปแล้ว)
 * รับ client เข้ามาเพื่อให้เรียกอยู่ใน $transaction เดียวกับการอัปเดตการ์ดได้
 */
export async function awardCardCompletion(
  client: Prisma.TransactionClient,
  {
    userId,
    boardId,
    card,
    completedAt,
  }: { userId: string; boardId: string; card: CardForAward; completedAt: Date }
): Promise<number> {
  const earned: { type: PointEventType; points: number }[] = [
    { type: PointEventType.CARD_COMPLETED, points: POINTS[PointEventType.CARD_COMPLETED] },
  ];

  if (card.dueDate && isOnTime(card.dueDate, completedAt)) {
    earned.push({
      type: PointEventType.ON_TIME_BONUS,
      points: POINTS[PointEventType.ON_TIME_BONUS],
    });
  }

  const existing = await client.pointEvent.findMany({
    where: { cardId: card.id },
    select: { type: true },
  });
  const alreadyEarned = new Set(existing.map((event) => event.type));
  const toCreate = earned.filter((event) => !alreadyEarned.has(event.type));

  if (toCreate.length === 0) return 0;

  // skipDuplicates + unique constraint คือด่านสุดท้ายกันเคสกดพร้อมกันสองแท็บ
  await client.pointEvent.createMany({
    data: toCreate.map((event) => ({
      userId,
      boardId,
      cardId: card.id,
      type: event.type,
      points: event.points,
    })),
    skipDuplicates: true,
  });

  return toCreate.reduce((sum, event) => sum + event.points, 0);
}

export async function getUserGameStats(userId: string) {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, recent, completedThisWeek, completedTotal] = await Promise.all([
    prisma.pointEvent.aggregate({ where: { userId }, _sum: { points: true } }),
    prisma.pointEvent.findMany({
      where: { userId, createdAt: { gte: sixtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.pointEvent.count({
      where: {
        userId,
        type: PointEventType.CARD_COMPLETED,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.pointEvent.count({
      where: { userId, type: PointEventType.CARD_COMPLETED },
    }),
  ]);

  const points = total._sum.points ?? 0;

  return {
    points,
    ...levelFromPoints(points),
    streak: streakFromDayKeys(new Set(recent.map((event) => dateKey(event.createdAt)))),
    completedThisWeek,
    completedTotal,
  };
}

/** สรุปแต้ม + ความคืบหน้าของบอร์ดเดียว ใช้บนหัวหน้าบอร์ด */
export async function getBoardGameSummary(boardId: string, userId: string) {
  const [myPoints, totalCards, doneCards] = await Promise.all([
    prisma.pointEvent.aggregate({ where: { boardId, userId }, _sum: { points: true } }),
    prisma.card.count({ where: { list: { boardId } } }),
    prisma.card.count({ where: { list: { boardId }, isCompleted: true } }),
  ]);

  return {
    myPoints: myPoints._sum.points ?? 0,
    totalCards,
    doneCards,
    progress: totalCards > 0 ? (doneCards / totalCards) * 100 : 0,
  };
}
