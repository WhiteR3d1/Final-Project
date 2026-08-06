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

  const boardAccents = ["#6366f1", "#0ea5e9", "#f59e0b", "#f43f5e", "#8b5cf6"];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Kanban+</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {user.name ?? user.email}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-black/5 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>

      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">My Boards</h2>
          <form action={createBoardAction} className="flex gap-2">
            <input
              type="text"
              name="name"
              placeholder="ชื่อบอร์ดใหม่"
              autoComplete="off"
              required
              className="rounded-md border border-black/10 bg-transparent px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none dark:border-white/10"
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
            >
              + สร้างบอร์ด
            </button>
          </form>
        </div>
        {ownedBoards.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/10">
            ยังไม่มีบอร์ด — สร้างบอร์ดแรกของคุณด้านบนได้เลย
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {ownedBoards.map((board, index) => (
              <Link
                key={board.id}
                href={`/board/${board.id}`}
                className="group overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-white/5 dark:bg-zinc-900"
              >
                <div
                  className="h-1.5"
                  style={{
                    backgroundColor: board.color ?? boardAccents[index % boardAccents.length],
                  }}
                />
                <div className="p-4">
                  <div className="font-medium text-zinc-800 group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-white">
                    {board.name}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {board._count.lists} lists
                    {board._count.members > 0 &&
                      ` · shared with ${board._count.members}`}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {sharedBoards.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-5 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            Shared with me
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {sharedBoards.map((board, index) => (
              <Link
                key={board.id}
                href={`/board/${board.id}`}
                className="group overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-white/5 dark:bg-zinc-900"
              >
                <div
                  className="h-1.5"
                  style={{
                    backgroundColor: board.color ?? boardAccents[index % boardAccents.length],
                  }}
                />
                <div className="p-4">
                  <div className="font-medium text-zinc-800 group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-white">
                    {board.name}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    by {board.owner.name ?? board.owner.email}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
