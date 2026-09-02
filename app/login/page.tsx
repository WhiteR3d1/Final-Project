"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { login } from "@/app/actions/auth";

const fieldClass =
  "border-line bg-panel-2 text-text focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";

function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="bg-accent text-accent-ink flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold">
          K
        </span>
        <span className="text-text text-lg font-semibold tracking-tight">Kanban+</span>
      </div>

      <div className="border-line bg-panel rounded-2xl border p-6">
        <h1 className="text-text mb-1 text-xl font-semibold">เข้าสู่ระบบ</h1>
        <p className="text-muted mb-5 text-sm">จัดการงานของคุณต่อจากที่ค้างไว้</p>

        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="email" className="text-muted mb-1 block text-sm">
              อีเมล
            </label>
            <input id="email" name="email" type="email" className={fieldClass} />
            {state?.errors?.email && (
              <p className="text-danger mt-1 text-xs">{state.errors.email[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="text-muted mb-1 block text-sm">
              รหัสผ่าน
            </label>
            <input id="password" name="password" type="password" className={fieldClass} />
            {state?.errors?.password && (
              <p className="text-danger mt-1 text-xs">{state.errors.password[0]}</p>
            )}
          </div>

          {state?.message && <p className="text-danger text-sm">{state.message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="bg-accent text-accent-ink mt-2 rounded-lg px-4 py-2 text-sm font-semibold hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>

      <p className="text-muted mt-4 text-center text-sm">
        ยังไม่มีบัญชี?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="text-accent underline"
        >
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  );
}

// useSearchParams() บังคับให้ต้องมี Suspense คั่น ไม่งั้น next build จะ prerender หน้านี้ไม่ผ่าน
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
