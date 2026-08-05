import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { assertBoardAccess } from "@/lib/board-access";
import { InviteStatus } from "@/app/generated/prisma/enums";
import { createLabelAction, createInviteAction } from "./actions";
import { KanbanBoard } from "./kanban-board";

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
      <header className="mb-8 flex items-center gap-4">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Boards
        </Link>
        <h1 className="text-xl font-semibold">{board.name}</h1>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">สมาชิก:</span>
          <span className="text-zinc-700 dark:text-zinc-300">
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
            className="rounded border border-black/10 bg-transparent px-2 py-1 text-xs focus:outline-none dark:border-white/10"
          />
          <button
            type="submit"
            className="text-xs text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
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
            className="rounded border border-black/10 bg-transparent px-2 py-1 text-xs focus:outline-none dark:border-white/10"
          />
          <input
            type="color"
            name="color"
            defaultValue="#71717a"
            className="h-6 w-8 rounded border border-black/10 bg-transparent dark:border-white/10"
          />
          <button
            type="submit"
            className="text-xs text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            + ป้ายกำกับ
          </button>
        </form>
      </div>

      {board.invites.length > 0 && (
        <div className="mb-6 text-xs text-zinc-500">
          <div className="mb-1 font-medium">คำเชิญที่รอตอบรับ:</div>
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
        initialLists={board.lists}
        boardLabels={board.labels}
        boardMembers={boardMembers}
      />

      <section className="mt-10 max-w-xl">
        <h2 className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          กิจกรรมล่าสุด
        </h2>
        {activities.length === 0 ? (
          <p className="text-xs text-zinc-400">ยังไม่มีกิจกรรม</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activities.map((activity) => (
              <li key={activity.id} className="text-xs text-zinc-500 dark:text-zinc-400">
                {activity.message}{" "}
                <span className="text-zinc-400 dark:text-zinc-500">
                  {new Intl.DateTimeFormat("th-TH", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(activity.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
