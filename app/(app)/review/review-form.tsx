"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/app/components/ui/buttons";
import { reviewCardAction, type ReviewFormState } from "./actions";

const fieldClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";

/** ฟอร์มให้คะแนน — ปุ่มสองปุ่มส่ง intent ต่างกันผ่าน name/value ของปุ่ม submit */
export function ReviewForm({
  cardId,
  defaultScore,
  defaultFeedback,
  canApprove,
}: {
  cardId: string;
  defaultScore: number | null;
  defaultFeedback: string | null;
  /** บอร์ดที่ไม่มีคอลัมน์เสร็จสิ้นอนุมัติไม่ได้ (ไม่มีที่ให้ย้ายการ์ดไป) */
  canApprove: boolean;
}) {
  const [state, action] = useActionState<ReviewFormState, FormData>(reviewCardAction, undefined);
  // controlled เพราะ React 19 ล้างช่อง uncontrolled หลัง action จบเสมอ
  // ตรวจไม่ผ่าน (เช่นลืมเขียนความเห็นตอนส่งกลับ) แล้วคะแนนที่กรอกไว้จะหายไปด้วย
  const [score, setScore] = useState(defaultScore?.toString() ?? "");
  const [feedback, setFeedback] = useState(defaultFeedback ?? "");

  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="cardId" value={cardId} />

      <div>
        <label className="text-muted mb-1 block text-xs font-medium" htmlFor={`score-${cardId}`}>
          คะแนน (0–100)
        </label>
        <input
          id={`score-${cardId}`}
          type="number"
          name="score"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          value={score}
          onChange={(event) => setScore(event.target.value)}
          className={`${fieldClass} tabular-nums`}
        />
      </div>

      <div>
        <label className="text-muted mb-1 block text-xs font-medium" htmlFor={`feedback-${cardId}`}>
          ความเห็นถึงนักศึกษา
        </label>
        <textarea
          id={`feedback-${cardId}`}
          name="feedback"
          rows={3}
          maxLength={2000}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="ทำได้ดีตรงไหน / ต้องแก้อะไร"
          className={`${fieldClass} resize-y`}
        />
      </div>

      {state?.error && <p className="text-danger text-xs">{state.error}</p>}
      {state?.message && <p className="text-accent text-xs">{state.message}</p>}

      <ReviewButtons canApprove={canApprove} />
    </form>
  );
}

function ReviewButtons({ canApprove }: { canApprove: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <SubmitButton
        name="intent"
        value="approve"
        disabled={!canApprove}
        title={canApprove ? undefined : "บอร์ดนี้ยังไม่มีคอลัมน์เสร็จสิ้น"}
        pendingLabel="กำลังบันทึก..."
        className="bg-accent text-accent-ink rounded-lg px-4 py-1.5 text-sm font-medium hover:brightness-110"
      >
        อนุมัติ
      </SubmitButton>
      <SubmitButton
        name="intent"
        value="changes"
        className="border-line text-warn hover:bg-warn/10 rounded-lg border px-3 py-1.5 text-sm font-medium"
      >
        ส่งกลับแก้ไข
      </SubmitButton>
    </div>
  );
}
