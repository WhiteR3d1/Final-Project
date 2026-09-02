import { PointEventType } from "@/app/generated/prisma/enums";
import { dateKey } from "./due";

/**
 * คณิตศาสตร์ของระบบแต้มล้วน ๆ — ไม่แตะ DB จึงเขียน unit test ครอบได้
 * ส่วนที่อ่าน/เขียน ledger อยู่ที่ `lib/gamification.ts` ซึ่ง re-export ค่าจากไฟล์นี้ต่อ
 * กติกาแต้มยังอยู่ที่เดียว แค่ผ่าเป็นสองไฟล์ตามว่าแตะ DB หรือไม่
 */

export const POINTS = {
  [PointEventType.CARD_COMPLETED]: 10,
  [PointEventType.ON_TIME_BONUS]: 5,
} as const;

export const LEVEL_TITLES = [
  "มือใหม่หัดวางแผน",
  "นักจัดการงาน",
  "นักล่าเดดไลน์",
  "มือโปรประจำทีม",
  "เจ้าแห่งบอร์ด",
  "ตำนานส่งงานตรงเวลา",
];

export const MAX_LEVEL = 99;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** แต้มสะสมที่ต้องมีเพื่อขึ้นเลเวล n (เลเวล 1 เริ่มที่ 0 แต้ม) */
export function pointsToReachLevel(level: number): number {
  const n = level - 1;
  return n * n * 10 + n * 40;
}

export function levelFromPoints(points: number) {
  let level = 1;
  while (level < MAX_LEVEL && pointsToReachLevel(level + 1) <= points) level++;

  const currentFloor = pointsToReachLevel(level);
  const nextAt = pointsToReachLevel(level + 1);
  const span = nextAt - currentFloor;

  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    currentFloor,
    nextAt,
    pointsToNext: Math.max(nextAt - points, 0),
    progress: span > 0 ? Math.min(((points - currentFloor) / span) * 100, 100) : 100,
  };
}

/**
 * นับวันติดต่อกันที่ผู้ใช้ทำงานเสร็จ (ยังไม่ทำวันนี้ = สตรีคยังไม่ขาด นับจากเมื่อวาน)
 * รับ `now` เข้ามาได้เพื่อให้เทสต์กำหนดวันเองได้ แบบเดียวกับ daysUntilDue() ใน lib/due.ts
 */
export function streakFromDayKeys(dayKeys: Set<string>, now: Date = new Date()): number {
  // ถอยทีละ 24 ชม.เป๊ะ ๆ แทน setDate() ที่อิง timezone ของเครื่อง
  // ไทยไม่มี DST คีย์วันแบบไทยจึงลดลงทีละ 1 เสมอ ไม่ว่าจะรันบนเครื่องโซนไหน
  let cursor = now.getTime();
  if (!dayKeys.has(dateKey(new Date(cursor)))) {
    cursor -= MS_PER_DAY;
  }

  let streak = 0;
  while (dayKeys.has(dateKey(new Date(cursor)))) {
    streak++;
    cursor -= MS_PER_DAY;
  }

  return streak;
}
