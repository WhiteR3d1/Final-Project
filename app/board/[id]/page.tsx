import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { assertBoardAccess } from "@/lib/board-access";
import { InviteStatus } from "@/app/generated/prisma/enums";
import { createLabelAction, createInviteAction } from "./actions";
import { KanbanBoard } from "./kanban-board";
import { PriorityManager } from "./priority-manager";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
              comments: {
                orderBy: { createdAt: "asc" },
                include: { user: true },
              },
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

  const activities = await prisma.activity.findMany({
    where: { boardId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const boardMembers = [
    board.owner,
    ...board.members.map((m) => m.user).filter((u) => u.id !== board.owner.id),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-black/5 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-200"
        >
          ← Boards
        </Link>
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: board.color ?? "#6366f1" }}
        />
        <h1 className="text-2xl font-semibold tracking-tight">{board.name}</h1>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-black/5 bg-zinc-50 px-4 py-3 text-sm dark:border-white/5 dark:bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 dark:text-zinc-500">สมาชิก</span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {board.owner.name ?? board.owner.email} (เจ้าของ)
            {board.members.length > 0 &&
              `, ${board.members.map((m) => m.user.name ?? m.user.email).join(", ")}`}
          </span>
        </div>

        <form action={createInviteAction} className="flex items-center gap-2">
          <input type="hidden" name="boardId" value={board.id} />
          <input
            type="email"
            name="email"
            placeholder="เชิญด้วยอีเมล"
            required
            className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs focus:border-zinc-400 focus:outline-none dark:border-white/10 dark:bg-zinc-800"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
          >
            + เชิญ
          </button>
        </form>

        <form action={createLabelAction} className="flex items-center gap-2">
          <input type="hidden" name="boardId" value={board.id} />
          <input
            type="text"
            name="name"
            placeholder="ชื่อป้ายกำกับ"
            required
            className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs focus:border-zinc-400 focus:outline-none dark:border-white/10 dark:bg-zinc-800"
          />
          <input
            type="color"
            name="color"
            defaultValue="#71717a"
            className="h-6 w-8 cursor-pointer rounded-md border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-800"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
          >
            + ป้ายกำกับ
          </button>
        </form>

        <PriorityManager boardId={board.id} priorities={board.priorities} />
      </div>

      {board.invites.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="mb-1 font-medium">คำเชิญที่รอตอบรับ</div>
          <ul className="flex flex-col gap-1">
            {board.invites.map((invite) => (
              <li key={invite.id}>
                {invite.email} — ลิงก์เชิญ:{" "}
                <span className="font-mono">/invite/{invite.token}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <KanbanBoard
        boardId={board.id}
        initialLists={board.lists}
        boardLabels={board.labels}
        boardMembers={boardMembers}
        boardPriorities={board.priorities}
      />

      <section className="mt-10 max-w-xl">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          กิจกรรมล่าสุด
        </h2>
        {activities.length === 0 ? (
          <p className="text-xs text-zinc-400">ยังไม่มีกิจกรรม</p>
        ) : (
          <ul className="flex flex-col">
            {activities.map((activity, index) => (
              <li key={activity.id} className="relative flex gap-3 pb-4 pl-1 last:pb-0">
                {index < activities.length - 1 && (
                  <span className="absolute top-2.5 left-1.75 h-full w-px bg-zinc-200 dark:bg-zinc-700" />
                )}
                <span className="relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {activity.message}{" "}
                  <span className="text-zinc-400 dark:text-zinc-500">
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
      </section>
    </div>
  );
}
