"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/app/components/ui/buttons";
import { changePasswordAction, type PasswordFormState } from "./actions";

const fieldClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";
const labelClass = "text-muted mb-1.5 block text-xs font-medium";

const FIELDS = [
  { name: "currentPassword", label: "รหัสผ่านเดิม", autoComplete: "current-password" },
  { name: "newPassword", label: "รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)", autoComplete: "new-password" },
  { name: "confirmPassword", label: "ยืนยันรหัสผ่านใหม่", autoComplete: "new-password" },
] as const;

/** ช่องรหัสผ่านเป็น uncontrolled โดยตั้งใจ — React ล้างให้หลังส่ง รหัสจะได้ไม่ค้างอยู่บนจอ */
export function PasswordForm() {
  const [state, action] = useActionState<PasswordFormState, FormData>(changePasswordAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {FIELDS.map((field) => (
        <div key={field.name}>
          <label className={labelClass} htmlFor={field.name}>
            {field.label}
          </label>
          <input
            id={field.name}
            name={field.name}
            type="password"
            required
            autoComplete={field.autoComplete}
            className={fieldClass}
          />
          {state?.errors?.[field.name]?.map((error) => (
            <p key={error} className="text-danger mt-1 text-xs">
              {error}
            </p>
          ))}
        </div>
      ))}

      {state?.message && <p className="text-accent text-sm">{state.message}</p>}

      <SubmitButton
        pendingLabel="กำลังบันทึก..."
        className="bg-accent text-accent-ink self-start rounded-lg px-4 py-2 text-sm font-semibold hover:brightness-110"
      >
        เปลี่ยนรหัสผ่าน
      </SubmitButton>
    </form>
  );
}
