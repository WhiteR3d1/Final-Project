import type { ReactNode } from "react";
import type { Tone } from "./chip";

const TONE_CLASS: Record<Tone, { box: string; icon: string }> = {
  accent: { box: "bg-accent/10 border-accent/25", icon: "bg-accent/20 text-accent" },
  warn: { box: "bg-warn/10 border-warn/25", icon: "bg-warn/20 text-warn" },
  danger: { box: "bg-danger/10 border-danger/25", icon: "bg-danger/20 text-danger" },
  info: { box: "bg-info/10 border-info/25", icon: "bg-info/20 text-info" },
  neutral: { box: "bg-panel-2 border-line", icon: "bg-line text-muted" },
};

/** การ์ดตัวเลขสรุป (แถวสถิติบน dashboard) */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const styles = TONE_CLASS[tone];

  return (
    <div className={`rounded-xl border p-3.5 ${styles.box}`}>
      {icon && (
        <span
          className={`mb-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${styles.icon}`}
        >
          {icon}
        </span>
      )}
      <div className="text-muted text-xs">{label}</div>
      <div className="text-text mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-muted mt-0.5 text-[11px]">{hint}</div>}
    </div>
  );
}
