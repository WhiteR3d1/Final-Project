"use client";

import { useState, useTransition } from "react";
import { exportCourseScoresAction } from "../actions";

/**
 * ดาวน์โหลดคะแนนเป็น CSV โดยไม่ต้องมี API route — action คืน string มาแล้วสร้างไฟล์ฝั่งเบราว์เซอร์
 * (โปรเจกต์นี้ตั้งใจไม่มี route handler นอกจากของ NextAuth)
 */
export function CsvDownloadButton({ courseId }: { courseId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function download() {
    setError(null);
    startTransition(async () => {
      const result = await exportCourseScoresAction(courseId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={pending}
        className="bg-accent text-accent-ink rounded-lg px-4 py-1.5 text-sm font-semibold hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "กำลังเตรียมไฟล์..." : "ดาวน์โหลดคะแนน (CSV)"}
      </button>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
