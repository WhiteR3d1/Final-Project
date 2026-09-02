import type { Prisma } from "@/app/generated/prisma/client";

/** รูปร่างข้อมูลที่หน้าบอร์ดดึงมา ใช้ร่วมกันระหว่าง kanban-board / การ์ด / modal */
export type ListWithCards = Prisma.ListGetPayload<{
  include: {
    cards: {
      include: {
        checklists: { include: { items: true } };
        comments: { include: { user: true } };
        labels: { include: { label: true } };
        assignees: { include: { user: true } };
        priority: true;
        attachments: true;
      };
    };
  };
}>;

export type CardWithRelations = ListWithCards["cards"][number];
