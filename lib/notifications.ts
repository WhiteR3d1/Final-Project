import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import { accessibleBoardWhere } from "./boards";
import { canTeach, type UserRoleName } from "./roles";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * ผลตรวจที่ "เป็นของฉัน" — การ์ดที่ฉันส่งตรวจ (ไม่มีคนส่ง = คนสร้าง เหมือนตอนให้แต้ม)
 * หรือการ์ดที่ฉันเป็นผู้รับผิดชอบ ในบอร์ดที่ยังเข้าได้อยู่ และไม่ใช่ผลที่ฉันตรวจเอง
 */
export function myReviewsWhere(userId: string): Prisma.CardReviewWhereInput {
  return {
    reviewerId: { not: userId },
    card: {
      list: { board: accessibleBoardWhere(userId) },
      OR: [
        { submittedById: userId },
        { submittedById: null, createdById: userId },
        { assignees: { some: { userId } } },
      ],
    },
  };
}

/**
 * ตัวเลขบน sidebar — ห่อ cache() เพราะ sidebar render สองที่ (desktop + drawer มือถือ)
 * ผู้ใช้ใหม่ที่ยังไม่เคยเปิดหน้าผลตรวจนับจากตอนสมัคร
 */
export const getSidebarCounts = cache(
  async (user: { id: string; role: UserRoleName; createdAt: Date; reviewsSeenAt: Date | null }) => {
    const [pendingReviews, unreadReviews] = await Promise.all([
      canTeach(user.role)
        ? prisma.card.count({
            where: { list: { isReviewList: true, board: { course: { teacherId: user.id } } } },
          })
        : 0,
      prisma.cardReview.count({
        where: {
          ...myReviewsWhere(user.id),
          updatedAt: { gt: user.reviewsSeenAt ?? user.createdAt },
        },
      }),
    ]);

    return { pendingReviews, unreadReviews };
  }
);
