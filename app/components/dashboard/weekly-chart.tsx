import { getWeeklyCompletion } from "@/lib/dashboard";
import { Panel } from "@/app/components/ui/panel";
import { BarChart } from "@/app/components/ui/bar-chart";
import { Chip } from "@/app/components/ui/chip";

/** กราฟงานที่ทำเสร็จ 7 วันล่าสุด */
export async function WeeklyChart({ userId }: { userId: string }) {
  const data = await getWeeklyCompletion(userId);
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const best = Math.max(...data.map((point) => point.value));

  return (
    <Panel
      title="สัปดาห์นี้"
      subtitle={`ทำเสร็จ ${total} งานใน 7 วัน`}
      action={
        total > 0 ? (
          <Chip tone="accent">วันที่ดีที่สุด {best} งาน</Chip>
        ) : (
          <Chip tone="neutral">ยังไม่มีข้อมูล</Chip>
        )
      }
    >
      <BarChart data={data} height={132} />
    </Panel>
  );
}
