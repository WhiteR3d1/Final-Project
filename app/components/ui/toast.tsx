import type { ReactNode } from "react";

/** แถบแจ้งผลลอยมุมขวาล่าง (ใช้ตอนได้แต้ม) */
export function Toast({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="bg-accent text-accent-ink ring-accent/20 fixed right-6 bottom-6 z-50 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ring-4"
    >
      {children}
    </div>
  );
}
