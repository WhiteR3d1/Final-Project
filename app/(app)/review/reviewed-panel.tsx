"use client";

import { useState } from "react";
import { IconCheck } from "@/app/components/ui/icons";
import { CardReviewResult } from "../board/[id]/card-review-result";
import type { PublicUser } from "../board/[id]/types";
import { ReviewForm } from "./review-form";

/**
 * การ์ดที่ตรวจไปแล้ว (แท็บ "ตรวจแล้ว") — โชว์ผลสรุปแทนฟอร์ม กดแก้ไขถึงจะเปิดฟอร์มเดิมขึ้นมา
 * ไม่งั้นการ์ดที่ตรวจแล้วกับที่ยังไม่ตรวจหน้าตาเหมือนกันจนแยกไม่ออก
 * ใช้ key ตาม review.updatedAt จากฝั่งหน้า: บันทึกแล้ว server ส่งผลใหม่มา คอมโพเนนต์จะพับกลับเป็นสรุปเอง
 */
export function ReviewedPanel({
  cardId,
  review,
  canApprove,
}: {
  cardId: string;
  review: {
    status: "APPROVED" | "CHANGES_REQUESTED";
    score: number | null;
    feedback: string | null;
    updatedAt: Date;
    reviewer: PublicUser;
  };
  canApprove: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <ReviewForm
          cardId={cardId}
          defaultScore={review.score}
          defaultFeedback={review.feedback}
          canApprove={canApprove}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-muted hover:text-text self-start text-xs underline"
        >
          ยกเลิก ไม่แก้ผลตรวจ
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-accent flex items-center gap-1.5 text-sm font-semibold">
        <IconCheck size={16} /> ตรวจแล้ว
      </p>
      <CardReviewResult review={review} />
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="border-line text-muted hover:text-text hover:bg-panel-2 self-start rounded-lg border px-3 py-1.5 text-xs"
      >
        แก้ไขผลตรวจ
      </button>
    </div>
  );
}
