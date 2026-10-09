"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";

/**
 * ถือว่าอ่านผลตรวจแล้ว "ถึงเวลาที่ server render หน้านั้น" — ไม่ใช่ตอนที่ action นี้ทำงาน
 * ผลตรวจที่เข้ามาระหว่างเปิดหน้าอยู่จะได้ไม่ถูกนับว่าอ่านแล้วทั้งที่ยังไม่เคยเห็น
 */
export async function markReviewsSeenAction(renderedAt: string) {
  const seenAt = new Date(renderedAt);
  if (Number.isNaN(seenAt.getTime())) return;

  const user = await getCurrentUser();
  // ห้ามเชื่อเวลาจาก client เกินปัจจุบัน และห้ามย้อนเวลาที่อ่านไปแล้ว
  const clamped = seenAt > new Date() ? new Date() : seenAt;
  if (user.reviewsSeenAt && user.reviewsSeenAt >= clamped) return;

  await prisma.user.update({ where: { id: user.id }, data: { reviewsSeenAt: clamped } });

  // ตัวเลขบน sidebar อยู่ใน layout
  revalidatePath("/", "layout");
}
