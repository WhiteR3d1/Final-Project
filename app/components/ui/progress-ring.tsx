import type { ReactNode } from "react";

/** วงแหวนแสดงเปอร์เซ็นต์ด้วย SVG ล้วน (ไม่ใช้ไลบรารีกราฟ) */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  color = "var(--accent)",
  trackClassName = "text-line",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackClassName?: string;
  children?: ReactNode;
}) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clamped / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        {children ?? (
          <span className="text-text text-sm font-semibold tabular-nums">
            {Math.round(clamped)}%
          </span>
        )}
      </div>
    </div>
  );
}
