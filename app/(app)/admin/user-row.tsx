"use client";

import { useActionState, useState } from "react";
import { Avatar, displayName } from "@/app/components/ui/avatar";
import { Chip } from "@/app/components/ui/chip";
import { ConfirmSubmitButton, SubmitButton } from "@/app/components/ui/buttons";
import {
  resetUserPasswordAction,
  setUserDisabledAction,
  setUserRoleAction,
  type ResetPasswordState,
} from "./actions";

const inputClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none";
const ghostButtonClass =
  "border-line text-muted hover:text-text hover:bg-panel-2 rounded-lg border px-2.5 py-1.5 text-xs";

const ROLE_OPTIONS = [
  { value: "USER", label: "นักศึกษา" },
  { value: "TEACHER", label: "อาจารย์" },
  { value: "ADMIN", label: "แอดมิน" },
] as const;

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "TEACHER" | "ADMIN";
  disabled: boolean;
  /** สอนอยู่กี่วิชา — มีวิชาอยู่ห้ามลดเป็นนักศึกษาหรือระงับ (action กันอีกชั้น) */
  courseCount: number;
  /** แก้ไม่ได้: ตัวเอง หรือแอดมินจาก ADMIN_EMAILS — เหตุผลแสดงแทนปุ่ม */
  lockedReason: string | null;
};

/** แถวผู้ใช้ในหน้าแอดมิน — ด่านจริงอยู่ที่ action ปุ่มที่ซ่อนเป็นแค่ UX */
export function UserRow({ user }: { user: AdminUserRow }) {
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <li className="border-line flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <Avatar user={user} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-text truncate text-sm font-medium">{displayName(user)}</div>
          <div className="text-muted truncate text-xs">{user.email}</div>
        </div>

        {user.disabled && <Chip tone="danger">ถูกระงับ</Chip>}
        {user.courseCount > 0 && <Chip tone="neutral">สอน {user.courseCount} วิชา</Chip>}

        {user.lockedReason ? (
          <Chip tone="info" title={user.lockedReason}>
            {ROLE_OPTIONS.find((option) => option.value === user.role)?.label} · {user.lockedReason}
          </Chip>
        ) : (
          <>
            {/* เปลี่ยนแล้วส่งทันที ไม่ต้องมีปุ่มบันทึกแยก */}
            <form action={setUserRoleAction}>
              <input type="hidden" name="userId" value={user.id} />
              <select
                name="role"
                defaultValue={user.role}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
                aria-label={`role ของ ${displayName(user)}`}
                className={inputClass}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.value === "USER" && user.courseCount > 0}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </form>

            <button type="button" onClick={() => setResetOpen((open) => !open)} className={ghostButtonClass}>
              ตั้งรหัสใหม่
            </button>

            <form action={setUserDisabledAction}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="disabled" value={user.disabled ? "0" : "1"} />
              {user.disabled ? (
                <SubmitButton className={ghostButtonClass}>ยกเลิกระงับ</SubmitButton>
              ) : user.courseCount > 0 ? (
                <span className="text-muted text-[11px]" title="ให้ลบหรือย้ายรายวิชาก่อน">
                  ระงับไม่ได้ (ยังมีรายวิชา)
                </span>
              ) : (
                <ConfirmSubmitButton
                  confirmLabel="กดอีกครั้งเพื่อระงับ"
                  className={`${ghostButtonClass} hover:text-danger`}
                  confirmClassName="bg-danger text-danger-ink rounded-lg px-2.5 py-1.5 text-xs font-medium"
                >
                  ระงับบัญชี
                </ConfirmSubmitButton>
              )}
            </form>
          </>
        )}
      </div>

      {resetOpen && !user.lockedReason && <ResetPasswordForm userId={user.id} />}
    </li>
  );
}

function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action] = useActionState<ResetPasswordState, FormData>(resetUserPasswordAction, undefined);

  return (
    <form action={action} className="ml-10 flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        type="password"
        name="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"
        aria-label="รหัสผ่านใหม่"
        className={`${inputClass} min-w-52`}
      />
      <SubmitButton
        pendingLabel="กำลังบันทึก..."
        className="bg-accent text-accent-ink rounded-lg px-3 py-1.5 text-xs font-medium hover:brightness-110"
      >
        บันทึกรหัสใหม่
      </SubmitButton>
      {state?.error && <p className="text-danger w-full text-xs">{state.error}</p>}
      {state?.message && <p className="text-accent w-full text-xs">{state.message}</p>}
    </form>
  );
}
