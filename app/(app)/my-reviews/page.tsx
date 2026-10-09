import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { myReviewsWhere } from "@/lib/notifications";
import { Panel } from "@/app/components/ui/panel";
import { publicUserSelect } from "../board/[id]/types";
import { ReviewList } from "./review-list";

/** ผลตรวจงานของฉันจากอาจารย์ — เปิดหน้านี้แล้วตัวเลขแจ้งเตือนบน sidebar หาย */
export default async function MyReviewsPage() {
  const user = await getCurrentUser();
  // เวลาที่ render หน้านี้ — ใช้ตัดสินว่า "อ่านถึงไหน" (ดู markReviewsSeenAction)
  const renderedAt = new Date();
  const seenAt = user.reviewsSeenAt ?? user.createdAt;

  const reviews = await prisma.cardReview.findMany({
    where: myReviewsWhere(user.id),
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      score: true,
      feedback: true,
      updatedAt: true,
      reviewer: { select: publicUserSelect },
      card: { select: { title: true, list: { select: { board: { select: { id: true, name: true } } } } } },
    },
  });

  const items = reviews.map((review) => ({
    ...review,
    card: { title: review.card.title, board: review.card.list.board },
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-text text-xl font-bold tracking-tight">ผลตรวจของฉัน</h1>
        <p className="text-muted mt-0.5 text-xs">
          ผลตรวจจากอาจารย์ของการ์ดที่คุณส่งตรวจหรือเป็นผู้รับผิดชอบ (50 รายการล่าสุด)
        </p>
      </div>

      <Panel>
        {items.length === 0 ? (
          <p className="text-muted py-8 text-center text-sm">ยังไม่มีผลตรวจ</p>
        ) : (
          <ReviewList
            items={items}
            unreadIds={reviews.filter((review) => review.updatedAt > seenAt).map((review) => review.id)}
            renderedAt={renderedAt.toISOString()}
          />
        )}
      </Panel>
    </div>
  );
}
