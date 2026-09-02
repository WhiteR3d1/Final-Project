import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { assertBoardAccess } from "@/lib/board-access";
import { getBoardGameSummary } from "@/lib/gamification";
import { boardColor } from "@/lib/boards";
import { InviteStatus } from "@/app/generated/prisma/enums";
import { Panel } from "@/app/components/ui/panel";
import { ProgressRing } from "@/app/components/ui/progress-ring";
import { AvatarStack } from "@/app/components/ui/avatar";
import { Chip } from "@/app/components/ui/chip";
import { IconCalendar, IconTrophy } from "@/app/components/ui/icons";
import { KanbanBoard } from "./kanban-board";
import { BoardSettingsDialog } from "./board-settings-dialog";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  const access = await assertBoardAccess(id, user.id);
  if (!access) notFound();

  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      owner: true,
      members: { include: { user: true } },
      labels: true,
      priorities: { orderBy: { order: "asc" } },
      invites: {
        where: { status: InviteStatus.PENDING },
        orderBy: { createdAt: "desc" },
      },
      lists: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            orderBy: { position: "asc" },
            include: {
              checklists: {
                orderBy: { position: "asc" },
                include: { items: { orderBy: { position: "asc" } } },
              },
              comments: { orderBy: { createdAt: "asc" }, include: { user: true } },
              labels: { include: { label: true } },
              assignees: { include: { user: true } },
              priority: true,
            },
          },
        },
      },
    },
  });

  if (!board) notFound();

  const gameSummary = await getBoardGameSummary(id, user.id);
  const doneList = board.lists.find((list) => list.isDoneList);

  const activities = await prisma.activity.findMany({
    where: { boardId: id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const boardMembers = [
    board.owner,
    ...board.members.map((member) => member.user).filter((u) => u.id !== board.owner.id),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: boardColor(board) }}
        />
        <h1 className="text-text text-xl font-bold tracking-tight">{board.name}</h1>
        <AvatarStack users={boardMembers} max={4} size={26} />

        {!access.canEdit && <Chip tone="info">ดูอย่างเดียว</Chip>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href={`/calendar?board=${board.id}`}
            className="border-line text-muted hover:text-text hover:bg-panel-2 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs"
          >
            <IconCalendar size={14} /> ดูเป็นปฏิทิน
          </Link>
          <BoardSettingsDialog
            boardId={board.id}
            labels={board.labels}
            priorities={board.priorities}
            invites={board.invites}
            canEdit={access.canEdit}
            canInvite={access.isOwner}
          />
        </div>
      </header>

      <Panel bodyClassName="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-3">
          <ProgressRing value={gameSummary.progress} size={56} stroke={6}>
            <span className="text-text text-[11px] font-semibold tabular-nums">
              {gameSummary.doneCards}/{gameSummary.totalCards}
            </span>
          </ProgressRing>
          <div>
            <div className="text-text text-sm font-medium">ความคืบหน้าบอร์ด</div>
            <div className="text-muted text-xs">
              เสร็จแล้ว {gameSummary.doneCards} จาก {gameSummary.totalCards} การ์ด
            </div>
          </div>
        </div>

        <div>
          <div className="text-muted text-xs">แต้มของฉันในบอร์ดนี้</div>
          <div className="text-accent flex items-center gap-1.5 text-xl font-bold tabular-nums">
            <IconTrophy size={18} /> {gameSummary.myPoints}
          </div>
        </div>

        <div className="ml-auto">
          {doneList ? (
            <Chip tone="accent">คอลัมน์เสร็จสิ้น: {doneList.name}</Chip>
          ) : (
            <Chip tone="warn">
              ยังไม่ได้ตั้งคอลัมน์เสร็จสิ้น — เปิดเมนู ⋯ ที่หัวคอลัมน์เพื่อเลือก
            </Chip>
          )}
        </div>
      </Panel>

      <KanbanBoard
        boardId={board.id}
        initialLists={board.lists}
        boardLabels={board.labels}
        boardMembers={boardMembers}
        boardPriorities={board.priorities}
        canEdit={access.canEdit}
      />

      <Panel title="กิจกรรมล่าสุด" className="max-w-2xl">
        {activities.length === 0 ? (
          <p className="text-muted text-xs">ยังไม่มีกิจกรรม</p>
        ) : (
          <ul className="flex flex-col">
            {activities.map((activity, index) => (
              <li key={activity.id} className="relative flex gap-3 pb-4 pl-1 last:pb-0">
                {index < activities.length - 1 && (
                  <span className="bg-line absolute top-2.5 left-1.75 h-full w-px" />
                )}
                <span className="bg-line relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                <p className="text-muted text-xs">
                  {activity.message}{" "}
                  <span className="opacity-70">
                    {new Intl.DateTimeFormat("th-TH", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(activity.createdAt)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
