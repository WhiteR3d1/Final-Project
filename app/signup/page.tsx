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
          <label htmlFor="name" className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
            ชื่อ
          </label>
          <input
            id="name"
            name="name"
            className="w-full rounded border border-black/10 bg-transparent px-3 py-2 text-sm focus:outline-none dark:border-white/10"
          />
          {state?.errors?.name && (
            <p className="mt-1 text-xs text-red-500">{state.errors.name[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
            อีเมล
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full rounded border border-black/10 bg-transparent px-3 py-2 text-sm focus:outline-none dark:border-white/10"
          />
          {state?.errors?.email && (
            <p className="mt-1 text-xs text-red-500">{state.errors.email[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="w-full rounded border border-black/10 bg-transparent px-3 py-2 text-sm focus:outline-none dark:border-white/10"
          />
          {state?.errors?.password && (
            <p className="mt-1 text-xs text-red-500">{state.errors.password[0]}</p>
          )}
        </div>

        {state?.message && <p className="text-sm text-red-500">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>
      </form>

      <p className="mt-4 text-sm text-zinc-500">
        มีบัญชีอยู่แล้ว?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="underline"
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
