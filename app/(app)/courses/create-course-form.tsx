"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/app/components/ui/buttons";
import { createCourseAction, type CourseFormState } from "./actions";

export function CreateCourseForm() {
  const [state, action] = useActionState<CourseFormState, FormData>(createCourseAction, undefined);

  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <input
        type="text"
        name="name"
        required
        maxLength={100}
        placeholder="ชื่อรายวิชา เช่น การพัฒนาเว็บ 1/2569"
        aria-label="ชื่อรายวิชา"
        className="border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none"
      />
      <SubmitButton
        pendingLabel="กำลังสร้าง..."
        className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-sm font-semibold hover:brightness-110"
      >
        สร้างรายวิชา
      </SubmitButton>
      {state?.error && <p className="text-danger w-full text-xs">{state.error}</p>}
    </form>
  );
}
