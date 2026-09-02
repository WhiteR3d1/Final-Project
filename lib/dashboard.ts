import "server-only";
import { prisma } from "./prisma";
import { PointEventType } from "@/app/generated/prisma/enums";
import { accessibleBoardWhere } from "./boards";
import { dateKey, todayKey } from "./due";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** จุดเริ่มต้นของวัน (ตามวันที่แบบไทย) ในรูปแบบเดียวกับที่ dueDate ถูกเก็บ = เที่ยงคืน UTC */
function dayStart(offsetDays = 0): Date {
  const base = new Date(`${todayKey()}T00:00:00.000Z`);
  return new Date(base.getTime() + offsetDays * MS_PER_DAY);
}

/** ตัวเลขสรุปงานทั้งหมดของผู้ใช้ (การ์ดจากทุกบอร์ดที่เข้าถึงได้) */
export async function getTaskCounts(userId: string) {
  const inAccessibleBoards = { list: { board: accessibleBoardWhere(userId) } };
  const today = dayStart();
  const tomorrow = dayStart(1);
  const inAWeek = dayStart(8);

  // "ภายใน 7 วัน" ต้องหมายถึงกลุ่ม soon ของ dueBucket() เป๊ะ ๆ (พรุ่งนี้ถึงอีก 7 วัน)
  // ไม่งั้นเลขบน dashboard จะไม่ตรงกับจำนวนการ์ดในกลุ่มเดียวกันที่ DueCards แสดงอยู่ข้าง ๆ
  const [overdue, dueToday, dueThisWeek, inProgress, completed, total] = await Promise.all([
    prisma.card.count({
      where: { ...inAccessibleBoards, isCompleted: false, dueDate: { lt: today } },
    }),
    prisma.card.count({
      where: {
        ...inAccessibleBoards,
        isCompleted: false,
        dueDate: { gte: today, lt: tomorrow },
      },
    }),
    prisma.card.count({
      where: {
        ...inAccessibleBoards,
        isCompleted: false,
        dueDate: { gte: tomorrow, lt: inAWeek },
      },
    }),
    prisma.card.count({ where: { ...inAccessibleBoards, isCompleted: false } }),
    prisma.card.count({ where: { ...inAccessibleBoards, isCompleted: true } }),
    prisma.card.count({ where: inAccessibleBoards }),
  ]);

  return { overdue, dueToday, dueThisWeek, inProgress, completed, total };
}

const THAI_WEEKDAY = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** จำนวนงานที่ทำเสร็จรายวัน 7 วันล่าสุด (วันนี้อยู่ขวาสุด) */
export async function getWeeklyCompletion(userId: string) {
  const since = new Date(Date.now() - 7 * MS_PER_DAY);

  const events = await prisma.pointEvent.findMany({
    where: { userId, type: PointEventType.CARD_COMPLETED, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const perDay = new Map<string, number>();
  for (const event of events) {
    const key = dateKey(event.createdAt);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() - (6 - index) * MS_PER_DAY);
    const key = dateKey(date);
    return {
      label: THAI_WEEKDAY[date.getDay()],
      value: perDay.get(key) ?? 0,
      highlight: index === 6,
    };
  });
}

/** ความคืบหน้ารวม + จำนวนที่ทำเสร็จในเดือนนี้ */
export async function getProgressOverview(userId: string) {
  const inAccessibleBoards = { list: { board: accessibleBoardWhere(userId) } };
  const monthStart = new Date(`${todayKey().slice(0, 7)}-01T00:00:00.000Z`);

  const [total, done, completedThisMonth, boards] = await Promise.all([
    prisma.card.count({ where: inAccessibleBoards }),
    prisma.card.count({ where: { ...inAccessibleBoards, isCompleted: true } }),
    prisma.pointEvent.count({
      where: { userId, type: PointEventType.CARD_COMPLETED, createdAt: { gte: monthStart } },
    }),
    prisma.board.count({ where: accessibleBoardWhere(userId) }),
  ]);

  return {
    total,
    done,
    remaining: total - done,
    percent: total > 0 ? (done / total) * 100 : 0,
    completedThisMonth,
    boards,
  };
}

/** แถวจุดกิจกรรม: วันไหนมีงานเสร็จบ้างใน N วันล่าสุด */
export async function getActivityDots(userId: string, days = 30) {
  const since = new Date(Date.now() - days * MS_PER_DAY);

  const events = await prisma.pointEvent.findMany({
    where: { userId, type: PointEventType.CARD_COMPLETED, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const activeDays = new Set(events.map((event) => dateKey(event.createdAt)));
  const today = new Date();

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - 1 - index) * MS_PER_DAY);
    return activeDays.has(dateKey(date));
  });
}
