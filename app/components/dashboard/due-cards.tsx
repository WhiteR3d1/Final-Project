import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { accessibleBoardWhere } from "@/lib/boards";
import { DUE_BUCKET_ORDER, DUE_BUCKET_STYLE, dueBucket, type DueBucket } from "@/lib/due";
import { Panel } from "@/app/components/ui/panel";
import { TaskRow } from "./task-row";

export type DueFilter = "all" | "mine";

/** รายการงานที่มีกำหนดส่งจากทุกบอร์ดที่ผู้ใช้เข้าถึงได้ จัดกลุ่มตามความเร่งด่วน */
export async function DueCards({ userId, filter }: { userId: string; filter: DueFilter }) {
  const cards = await prisma.card.findMany({
    where: {
      isCompleted: false,
      dueDate: { not: null },
      list: { board: accessibleBoardWhere(userId) },
      ...(filter === "mine" ? { assignees: { some: { userId } } } : {}),
    },
    include: {
      priority: { select: { name: true, color: true } },
      list: { select: { name: true, board: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: { dueDate: "asc" },
    take: 60,
  });

  // dueDate ถูกกรอง not null มาแล้ว แต่ TS ยังมองเป็น nullable
  const withDue = cards.map((card) => ({ ...card, dueDate: card.dueDate as Date }));

  const grouped = new Map<DueBucket, typeof withDue>();
  for (const card of withDue) {
    const bucket = dueBucket(card.dueDate);
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), card]);
  }

  return (
    <Panel
      title="งานที่ต้องส่ง"
      subtitle={withDue.length > 0 ? `ค้างอยู่ ${withDue.length} งาน` : undefined}
      action={
        <div className="bg-panel-2 flex gap-1 rounded-lg p-0.5 text-xs">
          <FilterLink current={filter} value="all" label="ทั้งหมด" />
          <FilterLink current={filter} value="mine" label="ของฉัน" />
        </div>
      }
    >
      {withDue.length === 0 ? (
        <p className="border-line text-muted rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          {filter === "mine"
            ? "ยังไม่มีงานที่มอบหมายให้คุณและตั้งกำหนดส่งไว้"
            : "ยังไม่มีงานที่ตั้งกำหนดส่งไว้ — เปิดการ์ดแล้วใส่วันที่ได้เลย"}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {DUE_BUCKET_ORDER.map((bucket) => {
            const bucketCards = grouped.get(bucket);
            if (!bucketCards || bucketCards.length === 0) return null;
            const style = DUE_BUCKET_STYLE[bucket];

            return (
              <div key={bucket}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <h3 className={`text-sm font-medium ${style.text}`}>{style.title}</h3>
                  <span className="text-muted text-xs tabular-nums">{bucketCards.length}</span>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {bucketCards.map((card) => (
                    <li key={card.id}>
                      <TaskRow card={card} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function FilterLink({
  current,
  value,
  label,
}: {
  current: DueFilter;
  value: DueFilter;
  label: string;
}) {
  const isActive = current === value;

  return (
    <Link
      href={`/?due=${value}`}
      className={`rounded-md px-2.5 py-1 ${
        isActive ? "bg-panel text-text font-medium shadow-sm" : "text-muted hover:text-text"
      }`}
    >
      {label}
    </Link>
  );
}
