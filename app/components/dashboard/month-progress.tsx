import { getProgressOverview } from "@/lib/dashboard";
import { Panel } from "@/app/components/ui/panel";
import { ProgressRing } from "@/app/components/ui/progress-ring";

/** วงแหวนความคืบหน้ารวมของงานทั้งหมด */
export async function MonthProgress({ userId }: { userId: string }) {
  const progress = await getProgressOverview(userId);

  return (
    <Panel title="ความคืบหน้า" subtitle="นับจากการ์ดทั้งหมดที่คุณเข้าถึงได้">
      <div className="flex items-center gap-5">
        <ProgressRing value={progress.percent} size={104} stroke={10}>
          <span className="text-text text-xl font-bold tabular-nums">
            {Math.round(progress.percent)}%
          </span>
          <span className="text-muted text-[11px]">เสร็จแล้ว</span>
        </ProgressRing>

        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="bg-accent h-2 w-2 rounded-full" />
            <span className="text-muted">เสร็จแล้ว</span>
            <span className="text-text font-semibold tabular-nums">{progress.done}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="bg-line h-2 w-2 rounded-full" />
            <span className="text-muted">เหลืออยู่</span>
            <span className="text-text font-semibold tabular-nums">{progress.remaining}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="bg-info h-2 w-2 rounded-full" />
            <span className="text-muted">เสร็จเดือนนี้</span>
            <span className="text-text font-semibold tabular-nums">
              {progress.completedThisMonth}
            </span>
          </li>
        </ul>
      </div>
    </Panel>
  );
}
