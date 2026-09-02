import { getCurrentUser } from "@/lib/dal";
import { displayName } from "@/app/components/ui/avatar";
import { GameStats } from "@/app/components/dashboard/game-stats";
import { DueCards, type DueFilter } from "@/app/components/dashboard/due-cards";
import { OverviewPanel } from "@/app/components/dashboard/overview-panel";
import { WeeklyChart } from "@/app/components/dashboard/weekly-chart";
import { MonthProgress } from "@/app/components/dashboard/month-progress";
import { BoardCards } from "@/app/components/dashboard/board-cards";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ due?: string }>;
}) {
  const user = await getCurrentUser();
  const { due } = await searchParams;
  const dueFilter: DueFilter = due === "mine" ? "mine" : "all";

  const today = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-text text-2xl font-bold tracking-tight">
          สวัสดี, {displayName(user)}!
        </h1>
        <p className="text-muted mt-1 text-sm">{today}</p>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <OverviewPanel userId={user.id} />
        </div>
        <div className="xl:col-span-1">
          <WeeklyChart userId={user.id} />
        </div>
        <div className="xl:col-span-1">
          <MonthProgress userId={user.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <GameStats userId={user.id} />
        </div>
        <div className="lg:col-span-2">
          <DueCards userId={user.id} filter={dueFilter} />
        </div>
      </div>

      <BoardCards userId={user.id} />
    </div>
  );
}
