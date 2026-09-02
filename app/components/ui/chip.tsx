import type { ReactNode } from "react";

export type Tone = "accent" | "warn" | "danger" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  accent: "bg-accent/15 text-accent",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
  neutral: "bg-panel-2 text-muted",
};

/**
 * ป้ายกลมขนาดเล็ก ใช้ได้ 2 แบบ
 * - `tone` สำหรับสีในระบบธีม
 * - `color` สำหรับสีที่ผู้ใช้ตั้งเอง (priority / label ที่เก็บ hex ไว้ใน DB)
 */
export function Chip({
  tone = "neutral",
  color,
  title,
  className = "",
  children,
}: {
  tone?: Tone;
  color?: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-5 font-medium whitespace-nowrap ${
        color ? "" : TONE_CLASS[tone]
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** จุดสีเล็ก ๆ ใช้คู่กับหัวคอลัมน์และรายการบอร์ด */
export function Dot({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
