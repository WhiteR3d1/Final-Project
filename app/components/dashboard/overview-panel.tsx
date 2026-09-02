import { getActivityDots, getProgressOverview, getTaskCounts } from "@/lib/dashboard";
import { DUE_BUCKET_STYLE } from "@/lib/due";
import { Panel } from "@/app/components/ui/panel";
import { StatTile } from "@/app/components/ui/stat-tile";
import { IconBoard, IconCheck, IconClock } from "@/app/components/ui/icons";

/** กล่องภาพรวม: ตัวเลขสรุป + แถวจุดกิจกรรม 30 วัน */
export async function OverviewPanel({ userId }: { userId: string }) {
  const [counts, progress, dots] = await Promise.all([
    getTaskCounts(userId),
    getProgressOverview(userId),
    getActivityDots(userId),
  ]);

  return (
    <Panel title="ภาพรวมทั้งหมด" subtitle="งานจากทุกบอร์ดที่คุณเข้าถึงได้">
      <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="text-text text-3xl font-bold tabular-nums">{progress.done}</div>
          <div className="text-muted text-xs">งานที่เสร็จแล้ว</div>
        </div>
        <div>
          <div className="text-text text-3xl font-bold tabular-nums">{counts.inProgress}</div>
          <div className="text-muted text-xs">ยังทำไม่เสร็จ</div>
        </div>
        <div>
          <div className="text-text text-3xl font-bold tabular-nums">{progress.boards}</div>
          <div className="text-muted text-xs">บอร์ดทั้งหมด</div>
        </div>
      </div>

      <div
        className="mb-5 flex flex-wrap gap-1"
        title="30 วันล่าสุด — จุดสว่างคือวันที่มีงานเสร็จ"
        aria-label="กิจกรรม 30 วันล่าสุด"
      >
        {dots.map((active, index) => (
          <span
            key={index}
            className={`h-1.5 w-1.5 rounded-full ${active ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="เลยกำหนดส่ง"
          value={counts.overdue}
          tone="danger"
          icon={<IconClock size={16} />}
          hint="ต้องรีบเคลียร์"
        />
        <StatTile
          label="ครบกำหนดวันนี้"
          value={counts.dueToday}
          tone="warn"
          icon={<IconCheck size={16} />}
          // ดึงคำจากแหล่งเดียวกับนิยามของกลุ่ม ป้ายชื่อกับตัวเลขจะได้ไม่หลุดคู่กัน
          hint={`${DUE_BUCKET_STYLE.soon.title} ${counts.dueThisWeek} งาน`}
        />
        <StatTile
          label="เสร็จเดือนนี้"
          value={progress.completedThisMonth}
          tone="accent"
          icon={<IconBoard size={16} />}
          hint={`จากงานทั้งหมด ${progress.total} ใบ`}
        />
      </div>
    </Panel>
  );
}
