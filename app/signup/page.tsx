"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { signup } from "@/app/actions/auth";

function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">สมัครสมาชิก</h1>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="name" className="text-muted mb-1 block text-sm">
            ชื่อ
          </label>
          <input
            id="name"
            name="name"
            className="border-line bg-panel-2 text-text focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          />
          {state?.errors?.name && (
            <p className="text-danger mt-1 text-xs">{state.errors.name[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="text-muted mb-1 block text-sm">
            อีเมล
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="border-line bg-panel-2 text-text focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          />
          {state?.errors?.email && (
            <p className="text-danger mt-1 text-xs">{state.errors.email[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="text-muted mb-1 block text-sm">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="border-line bg-panel-2 text-text focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          />
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
          {pending ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>
      </form>

      <p className="text-muted mt-4 text-center text-sm">
        มีบัญชีอยู่แล้ว?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-accent underline"
        >
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}

// useSearchParams() บังคับให้ต้องมี Suspense คั่น ไม่งั้น next build จะ prerender หน้านี้ไม่ผ่าน
export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
