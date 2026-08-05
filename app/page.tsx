import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import { createBoardAction } from "@/app/actions/board";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  const [ownedBoards, sharedBoards] = await Promise.all([
    prisma.board.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { lists: true, members: true } } },
    }),
    prisma.board.findMany({
      where: { members: { some: { userId: user.id } } },
      orderBy: { updatedAt: "desc" },
      include: { owner: true },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kanban+</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {user.name ?? user.email}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">My Boards</h2>
          <form action={createBoardAction} className="flex gap-2">
            <input
              type="text"
              name="name"
              placeholder="ชื่อบอร์ดใหม่"
              autoComplete="off"
              required
              className="rounded border border-black/10 bg-transparent px-3 py-1.5 text-sm focus:outline-none dark:border-white/10"
            />
            <button
              type="submit"
              className="rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background"
            >
              + สร้างบอร์ด
            </button>
          </form>
        </div>
        {ownedBoards.length === 0 ? (
          <p className="text-sm text-zinc-500">ยังไม่มีบอร์ด</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {ownedBoards.map((board) => (
              <Link
                key={board.id}
                href={`/board/${board.id}`}
                className="rounded-lg border border-black/10 p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
              >
                <div className="font-medium">{board.name}</div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {board._count.lists} lists
                  {board._count.members > 0 &&
                    ` · shared with ${board._count.members}`}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {sharedBoards.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-medium">Shared with me</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {sharedBoards.map((board) => (
              <Link
                key={board.id}
                href={`/board/${board.id}`}
                className="rounded-lg border border-black/10 p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
              >
                <div className="font-medium">{board.name}</div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  by {board.owner.name ?? board.owner.email}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
