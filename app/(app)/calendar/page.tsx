import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { accessibleBoardWhere, boardColor, getUserBoards } from "@/lib/boards";
import { dateKey, todayKey } from "@/lib/due";
import { Panel } from "@/app/components/ui/panel";
import { Chip } from "@/app/components/ui/chip";
import { IconChevronLeft, IconChevronRight } from "@/app/components/ui/icons";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

/** "YYYY-MM" ที่บวก/ลบเดือนแล้ว */
function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; board?: string }>;
}) {
  const user = await getCurrentUser();
  const { m, board: boardFilter } = await searchParams;

  const month = /^\d{4}-\d{2}$/.test(m ?? "") ? (m as string) : todayKey().slice(0, 7);
  const [year, monthIndex] = month.split("-").map(Number);

  const monthStart = new Date(Date.UTC(year, monthIndex - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const leadingBlanks = monthStart.getUTCDay();

  const { all: boards } = await getUserBoards(user.id);
  const activeBoard = boardFilter ? boards.find((item) => item.id === boardFilter) : undefined;

  const cards = await prisma.card.findMany({
    where: {
      dueDate: { gte: monthStart, lt: nextMonthStart },
      list: {
        board: activeBoard ? { id: activeBoard.id, ...accessibleBoardWhere(user.id) } : accessibleBoardWhere(user.id),
      },
    },
    include: {
      priority: { select: { color: true, name: true } },
      list: { select: { board: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: { dueDate: "asc" },
  });

  const byDay = new Map<string, typeof cards>();
  for (const card of cards) {
    if (!card.dueDate) continue;
    const key = dateKey(card.dueDate);
    byDay.set(key, [...(byDay.get(key) ?? []), card]);
  }

  const today = todayKey();
  const monthQuery = (target: string) =>
    `/calendar?m=${target}${activeBoard ? `&board=${activeBoard.id}` : ""}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-text text-xl font-bold tracking-tight">
          {MONTH_NAMES[monthIndex - 1]} {year + 543}
        </h1>
        <div className="flex items-center gap-1">
          <Link
            href={monthQuery(shiftMonth(month, -1))}
            aria-label="เดือนก่อนหน้า"
            className="border-line text-muted hover:text-text hover:bg-panel-2 rounded-lg border p-1.5"
          >
            <IconChevronLeft size={16} />
          </Link>
          <Link
            href={monthQuery(shiftMonth(month, 1))}
            aria-label="เดือนถัดไป"
            className="border-line text-muted hover:text-text hover:bg-panel-2 rounded-lg border p-1.5"
          >
            <IconChevronRight size={16} />
          </Link>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Link
            href="/calendar"
            className={`rounded-lg px-2.5 py-1 text-xs ${
              activeBoard ? "text-muted hover:text-text" : "bg-panel-2 text-text font-medium"
            }`}
          >
            ทุกบอร์ด
          </Link>
          {boards.map((item) => (
            <Link
              key={item.id}
              href={`/calendar?m=${month}&board=${item.id}`}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ${
                activeBoard?.id === item.id
                  ? "bg-panel-2 text-text font-medium"
                  : "text-muted hover:text-text"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: boardColor(item) }}
              />
              {item.name}
            </Link>
          ))}
        </div>
      </header>

      <Panel bodyClassName="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="mb-2 grid grid-cols-7 gap-2">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="text-muted text-center text-xs font-medium">
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: leadingBlanks }, (_, index) => (
              <div key={`blank-${index}`} />
            ))}

            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const key = `${month}-${String(day).padStart(2, "0")}`;
              const dayCards = byDay.get(key) ?? [];
              const isToday = key === today;

              return (
                <div
                  key={key}
                  className={`border-line bg-panel-2 flex min-h-24 flex-col gap-1 rounded-xl border p-2 ${
                    isToday ? "border-accent" : ""
                  }`}
                >
                  <span
                    className={`text-xs tabular-nums ${
                      isToday ? "text-accent font-bold" : "text-muted"
                    }`}
                  >
                    {day}
                  </span>

                  {dayCards.slice(0, 3).map((card) => (
                    <Link
                      key={card.id}
                      href={`/board/${card.list.board.id}`}
                      title={`${card.title} — ${card.list.board.name}`}
                      style={{
                        borderColor: card.priority?.color ?? boardColor(card.list.board),
                      }}
                      className={`bg-panel truncate rounded-md border-l-2 px-1.5 py-1 text-[11px] ${
                        card.isCompleted
                          ? "text-muted line-through"
                          : key < today
                            ? "text-danger"
                            : "text-text"
                      }`}
                    >
                      {card.title}
                    </Link>
                  ))}

                  {dayCards.length > 3 && (
                    <span className="text-muted text-[11px]">+{dayCards.length - 3} งาน</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="danger">สีแดง = เลยกำหนดและยังไม่เสร็จ</Chip>
        <Chip tone="neutral">ขีดฆ่า = ทำเสร็จแล้ว</Chip>
        <Chip tone="accent">กรอบเขียว = วันนี้</Chip>
      </div>
    </div>
  );
}
