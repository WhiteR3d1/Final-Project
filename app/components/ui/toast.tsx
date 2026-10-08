import type { ReactNode } from "react";

const TONE_CLASS = {
  accent: "bg-accent text-accent-ink ring-accent/20",
  warn: "bg-warn text-warn-ink ring-warn/20",
};

/** แถบแจ้งผลลอยมุมขวาล่าง (ใช้ตอนได้แต้ม / warn ตอนทำสิ่งที่ไม่มีสิทธิ์ เช่นลากเข้าเสร็จสิ้นก่อนอาจารย์ตรวจ) */
export function Toast({
  children,
  tone = "accent",
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <div
      role="status"
      className={`${TONE_CLASS[tone]} fixed right-6 bottom-6 z-50 max-w-[calc(100vw-3rem)] rounded-full px-4 py-2 text-sm font-semibold shadow-lg ring-4`}
    >
      {children}
    </div>
  );
}
