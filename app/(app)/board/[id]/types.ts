import type { Prisma } from "@/app/generated/prisma/client";

/**
 * ฟิลด์ของ User ที่ส่งไปให้ client ได้ — **ห้ามใช้ `user: true`** ในข้อมูลที่ส่งเข้า client component
 * เพราะ props ถูก serialize ลงหน้าเว็บทั้งก้อน ได้ทั้ง passwordHash ไปให้ทุกคนที่เปิดบอร์ดเห็น
 */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/** ผลตรวจของอาจารย์ที่นักศึกษาเห็นบนการ์ด */
export const cardReviewSelect = {
  status: true,
  score: true,
  feedback: true,
  updatedAt: true,
  reviewer: { select: publicUserSelect },
} satisfies Prisma.CardReviewSelect;

/** รูปร่างข้อมูลที่หน้าบอร์ดดึงมา ใช้ร่วมกันระหว่าง kanban-board / การ์ด / modal */
export type ListWithCards = Prisma.ListGetPayload<{
  include: {
    cards: {
      include: {
        checklists: { include: { items: true } };
        comments: { include: { user: { select: typeof publicUserSelect } } };
        labels: { include: { label: true } };
        assignees: { include: { user: { select: typeof publicUserSelect } } };
        priority: true;
        attachments: true;
        review: { select: typeof cardReviewSelect };
      };
    };
  };
}>;

export type CardWithRelations = ListWithCards["cards"][number];
