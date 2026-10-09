import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { ActivityType } from "@/app/generated/prisma/enums";
import { awardCardCompletion } from "./gamification";

export type CardForCompletion = {
  id: string;
  title: string;
  isCompleted: boolean;
  completedAt: Date | null;
  dueDate: Date | null;
};

/**
 * ซิงก์สถานะ "เสร็จ" ของการ์ดกับคอลัมน์ที่มันไปอยู่ แล้วคืนแต้มที่เพิ่งได้ (0 = ไม่ได้แต้มใหม่)
 * ทางเข้าเดียวของกติกาแต้ม — ลาก, ปุ่มย้าย และอาจารย์อนุมัติ ต้องเรียกฟังก์ชันนี้ ห้ามเขียนซ้ำ
 *
 * ลากออกจากคอลัมน์เสร็จสิ้นได้ตามปกติ — การ์ดกลับเป็น "กำลังทำ" แต่ completedAt กับ PointEvent
 * ยังอยู่ครบ แต้มที่ได้ไปแล้วจึงไม่ถูกริบ และการลากกลับเข้าไปใหม่ก็ไม่ได้แต้มซ้ำ
 *
 * รับ tx เข้ามาเพื่อให้ผู้เรียกรวมการย้ายการ์ด + กิจกรรม + แต้ม ไว้ใน transaction เดียว
 *
 * @param earner คนที่ได้แต้ม — ปกติคือคนลาก แต่ตอนอาจารย์อนุมัติคือนักศึกษาที่ส่งตรวจ
 * @param onTimeAt เวลาที่ใช้ตัดสินว่าทันกำหนดไหม — ตอนอนุมัติใช้เวลาที่ส่งตรวจ
 *   ไม่ใช่เวลาที่อาจารย์กด ไม่งั้นนักศึกษาเสียโบนัสเพราะอาจารย์ตรวจช้า
 */
export async function syncCardCompletion(
  tx: Prisma.TransactionClient,
  card: CardForCompletion,
  targetList: { isDoneList: boolean },
  boardId: string,
  earner: { id: string; name: string | null; email: string },
  onTimeAt?: Date | null
): Promise<number> {
  if (targetList.isDoneList && !card.isCompleted) {
    const completedAt = card.completedAt ?? new Date();

    await tx.card.update({
      where: { id: card.id },
      data: { isCompleted: true, completedAt },
    });

    const awarded = await awardCardCompletion(tx, {
      userId: earner.id,
      boardId,
      card: { id: card.id, dueDate: card.dueDate, completedAt: card.completedAt },
      completedAt: onTimeAt ?? completedAt,
    });

    await tx.activity.create({
      data: {
        boardId,
        cardId: card.id,
        userId: earner.id,
        type: ActivityType.CARD_COMPLETED,
        message: `${earner.name ?? earner.email} completed "${card.title}"${
          awarded > 0 ? ` (+${awarded} points)` : ""
        }`,
      },
    });

    return awarded;
  }

  if (!targetList.isDoneList && card.isCompleted) {
    await tx.card.update({
      where: { id: card.id },
      data: { isCompleted: false },
    });
  }

  return 0;
}
