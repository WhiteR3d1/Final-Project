import Link from "next/link";
import { getCourseLeaderboard, getMyCourses, type LeaderboardPeriod } from "@/lib/leaderboard";
import { Panel } from "@/app/components/ui/panel";
import { Avatar } from "@/app/components/ui/avatar";
import { IconFire } from "@/app/components/ui/icons";

const RANK_TONE = ["bg-accent text-accent-ink", "bg-warn text-warn-ink", "bg-info text-info-ink"];

/**
 * อันดับเพื่อนร่วมรายวิชา (นิยามและเหตุผลที่นับเฉพาะแต้มในวิชา ดู lib/leaderboard.ts)
 * ตัวเลือกวิชา/ช่วงเวลาเก็บใน searchParams (?lb=, ?lbp=) แบบเดียวกับตัวกรอง ?due= ของ DueCards
 */
export async function Leaderboard({
  userId,
  courseId,
  period,
  due,
}: {
  userId: string;
  courseId?: string;
  period: LeaderboardPeriod;
  /** ค่าตัวกรองของแผงงานที่ต้องส่ง — คงไว้ตอนกดลิงก์ของแผงนี้ */
  due?: string;
}) {
  const courses = await getMyCourses(userId);

  if (courses.length === 0) {
    return (
      <Panel title="อันดับในรายวิชา">
        <p className="text-muted py-4 text-center text-sm">
          ยังไม่ได้อยู่ในรายวิชาไหน — ผูกบอร์ดเข้ารายวิชาที่ &ldquo;ตั้งค่าบอร์ด → รายวิชา&rdquo;
          เพื่อดูเลเวลและแต้มของเพื่อนร่วมวิชา
        </p>
      </Panel>
    );
  }

  // id จาก URL เลือกได้แค่ในวิชาที่ตัวเองอยู่ ใส่วิชาอื่นมาก็ตกกลับเป็นวิชาแรก
  const course = courses.find((item) => item.id === courseId) ?? courses[0];
  const rows = await getCourseLeaderboard(userId, course, period);

  const href = (next: { course?: string; period?: LeaderboardPeriod }) => {
    const params = new URLSearchParams();
    if (due) params.set("due", due);
    params.set("lb", next.course ?? course.id);
    if ((next.period ?? period) === "week") params.set("lbp", "week");
    return `/?${params}`;
  };
  const toggleClass = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-xs ${active ? "bg-panel text-text font-semibold shadow-sm" : "text-muted hover:text-text"}`;

  return (
    <Panel
      title="อันดับในรายวิชา"
      subtitle={`${course.name} · แต้มจากบอร์ดในวิชา${period === "week" ? " 7 วันล่าสุด" : "ทั้งหมด"}`}
      action={
        <nav className="bg-panel-2 flex rounded-xl p-1">
          <Link href={href({ period: "all" })} scroll={false} className={toggleClass(period === "all")}>
            ทั้งหมด
          </Link>
          <Link href={href({ period: "week" })} scroll={false} className={toggleClass(period === "week")}>
            สัปดาห์นี้
          </Link>
        </nav>
      }
    >
      {courses.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {courses.map((item) => (
            <Link
              key={item.id}
              href={href({ course: item.id })}
              scroll={false}
              className={`rounded-lg px-2.5 py-1 text-xs ${
                item.id === course.id ? "bg-panel-2 text-text font-medium" : "text-muted hover:text-text"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-muted py-4 text-center text-sm">ยังไม่มีนักศึกษาส่งบอร์ดเข้าวิชานี้</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {rows.map((row, index) => (
            <li
              key={row.userId}
              className={`flex items-center gap-3 rounded-xl px-2 py-2 ${row.isMe ? "bg-panel-2" : ""} ${
                // แถวของฉันที่ต่อท้ายเพราะไม่ติดอันดับต้น ๆ — เว้นเส้นให้รู้ว่าข้ามอันดับไป
                row.isMe && index > 0 && rows[index - 1].rank < row.rank - 1 ? "border-line mt-2 border-t" : ""
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                  RANK_TONE[row.rank - 1] ?? "bg-panel-2 text-muted"
                }`}
              >
                {row.rank}
              </span>
              <Avatar user={row.user} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-text truncate text-sm font-medium">{row.name}</span>
                  {row.isMe && <span className="text-muted shrink-0 text-[11px]">(คุณ)</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-accent shrink-0 text-[11px] font-semibold">LV {row.level.level}</span>
                  <div className="bg-panel-2 h-1.5 max-w-40 flex-1 overflow-hidden rounded-full">
                    <div className="bg-accent h-full rounded-full" style={{ width: `${row.level.progress}%` }} />
                  </div>
                  <span className="text-muted hidden truncate text-[11px] sm:inline">{row.level.title}</span>
                </div>
              </div>
              {row.streak > 0 && (
                <span className="text-warn flex shrink-0 items-center gap-0.5 text-xs tabular-nums" title="วันติดต่อกัน">
                  <IconFire size={13} /> {row.streak}
                </span>
              )}
              <span className="text-text w-16 shrink-0 text-right text-sm font-semibold tabular-nums">
                {row.points} <span className="text-muted text-[11px] font-normal">แต้ม</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
