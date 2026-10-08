import { Chip } from "@/app/components/ui/chip";
import { displayName } from "@/app/components/ui/avatar";
import type { PublicUser } from "./types";

type ReviewResult = {
  status: "APPROVED" | "CHANGES_REQUESTED";
  score: number | null;
  feedback: string | null;
  updatedAt: Date;
  reviewer: PublicUser;
};

const REVIEWED_AT_FORMAT = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

/** ชิปสรุปผลตรวจ — ใช้ทั้งบนการ์ดในคอลัมน์และในหน้าต่างรายละเอียด */
export function ReviewChip({ review }: { review: Pick<ReviewResult, "status" | "score"> }) {
  if (review.status === "CHANGES_REQUESTED") {
    return <Chip tone="warn">ส่งกลับแก้ไข</Chip>;
  }
  return <Chip tone="info">คะแนน {review.score ?? "-"}</Chip>;
}

/** ผลตรวจของอาจารย์แบบอ่านอย่างเดียว (นักศึกษาเห็นในหน้าต่างการ์ด อาจารย์เห็นในหน้าตรวจงาน) */
export function CardReviewResult({ review }: { review: ReviewResult }) {
  return (
    <div className="border-line bg-panel-2 flex flex-col gap-1.5 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <ReviewChip review={review} />
        {review.status === "APPROVED" && <Chip tone="accent">อนุมัติแล้ว</Chip>}
      </div>
      {review.feedback && (
        <p className="text-text text-sm break-words whitespace-pre-wrap">{review.feedback}</p>
      )}
      <p className="text-muted text-[11px]">
        โดย {displayName(review.reviewer)} · {REVIEWED_AT_FORMAT.format(review.updatedAt)}
      </p>
    </div>
  );
}
