import { getUserGameStats } from "@/lib/gamification";
import { Panel } from "@/app/components/ui/panel";
import { ProgressRing } from "@/app/components/ui/progress-ring";
import { Chip } from "@/app/components/ui/chip";
import { IconFire, IconTrophy } from "@/app/components/ui/icons";

/** โปรไฟล์เกม — เลเวล/แต้ม/สตรีค คำนวณจาก ledger ของ PointEvent ทั้งหมด */
export async function GameStats({ userId }: { userId: string }) {
  const stats = await getUserGameStats(userId);

  return (
    <Panel
      title="ความคืบหน้าของฉัน"
      subtitle={stats.title}
      action={
        <Chip tone="accent">
          <IconTrophy size={12} /> {stats.points} แต้ม
        </Chip>
      }
    >
      <div className="flex items-center gap-5">
        <ProgressRing value={stats.progress} size={92} stroke={9}>
          <span className="text-muted text-[10px] leading-none">LV</span>
          <span className="text-text text-2xl leading-none font-bold">{stats.level}</span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <p className="text-muted text-xs">
            {stats.pointsToNext > 0
              ? `อีก ${stats.pointsToNext} แต้มขึ้นเลเวล ${stats.level + 1}`
              : "เลเวลสูงสุดแล้ว"}
          </p>
          <div className="bg-panel-2 mt-2 h-2 overflow-hidden rounded-full">
            <div
              className="bg-accent h-full rounded-full transition-all"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          <div className="text-muted mt-1 flex justify-between text-[11px] tabular-nums">
            <span>{stats.currentFloor}</span>
            <span>{stats.nextAt}</span>
          </div>
        </div>
      </div>

      <div className="border-line mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-center">
        <div>
          <div className="text-warn flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
            <IconFire size={16} /> {stats.streak}
          </div>
          <div className="text-muted text-[11px]">วันติดต่อกัน</div>
        </div>
        <div>
          <div className="text-text text-lg font-semibold tabular-nums">
            {stats.completedThisWeek}
          </div>
          <div className="text-muted text-[11px]">เสร็จสัปดาห์นี้</div>
        </div>
        <div>
          <div className="text-text text-lg font-semibold tabular-nums">
            {stats.completedTotal}
          </div>
          <div className="text-muted text-[11px]">เสร็จทั้งหมด</div>
        </div>
      </div>
    </Panel>
  );
}
