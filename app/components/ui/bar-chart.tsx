/** กราฟแท่งแนวตั้งด้วย div ล้วน — ใช้กับสรุปงานที่เสร็จราย 7 วัน */
export function BarChart({
  data,
  height = 120,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  height?: number;
}) {
  const max = Math.max(...data.map((point) => point.value), 1);

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((point, index) => {
        const ratio = point.value / max;
        return (
          <div key={index} className="flex h-full flex-1 flex-col items-center gap-1">
            <span className="text-muted h-4 text-[10px] tabular-nums">
              {point.value > 0 ? point.value : ""}
            </span>
            <div className="bg-panel-2 flex w-full flex-1 items-end overflow-hidden rounded-full">
              <div
                title={`${point.label}: ${point.value}`}
                style={{ height: `${Math.max(ratio * 100, point.value > 0 ? 8 : 0)}%` }}
                className={`w-full rounded-full transition-all ${
                  point.highlight ? "bg-accent" : "bg-warn"
                }`}
              />
            </div>
            <span className="text-muted text-[11px]">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}
