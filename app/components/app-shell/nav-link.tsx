"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** เมนู sidebar ที่รู้ว่าตัวเองเป็นหน้าปัจจุบันหรือไม่ (usePathname ไม่ต้องมี Suspense ครอบ) */
export function NavLink({
  href,
  icon,
  children,
  exact = false,
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-text text-surface font-semibold"
          : "text-muted hover:bg-panel-2 hover:text-text"
      }`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}

/** ลิงก์บอร์ดใน sidebar — ไฮไลต์เมื่อกำลังเปิดบอร์ดนั้นอยู่ */
export function BoardNavLink({
  href,
  color,
  children,
}: {
  href: string;
  color: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
        isActive ? "bg-panel-2 text-text font-medium" : "text-muted hover:bg-panel-2 hover:text-text"
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{children}</span>
    </Link>
  );
}
