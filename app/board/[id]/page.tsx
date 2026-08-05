import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { assertBoardAccess } from "@/lib/board-access";
import { InviteStatus } from "@/app/generated/prisma/enums";
import {
  createCardAction,
  createChecklistAction,
  addChecklistItemAction,
  toggleChecklistItemAction,
  deleteChecklistItemAction,
  addCommentAction,
  createLabelAction,
  toggleCardLabelAction,
  toggleCardAssigneeAction,
  createInviteAction,
} from "./actions";
import { CardMoveButtons } from "./card-move-buttons";

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

      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.lists.map((list, listIndex) => (
          <div
            key={list.id}
            className="w-72 shrink-0 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900"
          >
            <h2 className="mb-3 px-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {list.name}
            </h2>

            <div className="flex flex-col gap-2">
              {list.cards.map((card) => {
                const items = card.checklists.flatMap((c) => c.items);
                const done = items.filter((i) => i.isCompleted).length;

                return (
                  <div
                    key={card.id}
                    className="rounded-md bg-white p-3 text-sm shadow-sm dark:bg-zinc-800"
                  >
                    <div className={card.isCompleted ? "line-through text-zinc-400" : ""}>
                      {card.title}
                    </div>
                    <div className="mt-1 flex gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {items.length > 0 && (
                        <span>
                          {done}/{items.length}
                        </span>
                      )}
                      {card.dueDate && (
                        <span>
                          {new Intl.DateTimeFormat("th-TH", {
                            day: "numeric",
                            month: "short",
                          }).format(card.dueDate)}
                        </span>
                      )}
                    </div>

                    {board.labels.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {board.labels.map((label) => {
                          const isAssigned = card.labels.some(
                            (cl) => cl.labelId === label.id
                          );
                          return (
                            <form key={label.id} action={toggleCardLabelAction}>
                              <input type="hidden" name="cardId" value={card.id} />
                              <input type="hidden" name="labelId" value={label.id} />
                              <button
                                type="submit"
                                title={label.name}
                                style={{
                                  backgroundColor: isAssigned ? label.color : "transparent",
                                  borderColor: label.color,
                                }}
                                className="h-3 w-3 rounded-full border-2"
                              />
                            </form>
                          );
                        })}
                      </div>
                    )}

                    {boardMembers.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {boardMembers.map((member) => {
                          const isAssigned = card.assignees.some(
                            (a) => a.userId === member.id
                          );
                          const initial = (member.name ?? member.email)[0].toUpperCase();
                          return (
                            <form key={member.id} action={toggleCardAssigneeAction}>
                              <input type="hidden" name="cardId" value={card.id} />
                              <input type="hidden" name="userId" value={member.id} />
                              <button
                                type="submit"
                                title={member.name ?? member.email}
                                className={
                                  isAssigned
                                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] text-white"
                                    : "flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-zinc-400 text-[10px] text-zinc-400"
                                }
                              >
                                {initial}
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    )}

                    {card.checklists.map((checklist) => (
                      <div key={checklist.id} className="mt-2 flex flex-col gap-1">
                        {checklist.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-1.5">
                            <form action={toggleChecklistItemAction}>
                              <input type="hidden" name="itemId" value={item.id} />
                              <button
                                type="submit"
                                className={
                                  item.isCompleted
                                    ? "text-xs text-emerald-500"
                                    : "text-xs text-zinc-400"
                                }
                              >
                                {item.isCompleted ? "☑" : "☐"}
                              </button>
                            </form>
                            <span
                              className={
                                item.isCompleted
                                  ? "flex-1 text-xs text-zinc-400 line-through"
                                  : "flex-1 text-xs text-zinc-600 dark:text-zinc-300"
                              }
                            >
                              {item.content}
                            </span>
                            <form action={deleteChecklistItemAction}>
                              <input type="hidden" name="itemId" value={item.id} />
                              <button
                                type="submit"
                                className="text-xs text-zinc-400 hover:text-red-500"
                              >
                                ×
                              </button>
                            </form>
                          </div>
                        ))}
                        <form action={addChecklistItemAction}>
                          <input type="hidden" name="checklistId" value={checklist.id} />
                          <input
                            type="text"
                            name="content"
                            placeholder="+ เพิ่มรายการ"
                            autoComplete="off"
                            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-zinc-500 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none dark:focus:border-zinc-600"
                          />
                        </form>
                      </div>
                    ))}

                    {card.checklists.length === 0 && (
                      <form action={createChecklistAction} className="mt-2">
                        <input type="hidden" name="cardId" value={card.id} />
                        <button
                          type="submit"
                          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          + Checklist
                        </button>
                      </form>
                    )}

                    <div className="mt-2 flex flex-col gap-1 border-t border-black/5 pt-2 dark:border-white/5">
                      {card.comments.map((comment) => (
                        <div key={comment.id} className="text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-medium text-zinc-600 dark:text-zinc-300">
                            {comment.user.name ?? comment.user.email}
                          </span>{" "}
                          {comment.content}
                        </div>
                      ))}
                      <form action={addCommentAction}>
                        <input type="hidden" name="cardId" value={card.id} />
                        <input
                          type="text"
                          name="content"
                          placeholder="+ แสดงความคิดเห็น"
                          autoComplete="off"
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-zinc-500 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none dark:focus:border-zinc-600"
                        />
                      </form>
                    </div>

                    <CardMoveButtons
                      cardId={card.id}
                      canMoveLeft={listIndex > 0}
                      canMoveRight={listIndex < board.lists.length - 1}
                    />
                  </div>
                );
              })}

              {list.cards.length === 0 && (
                <div className="px-1 text-xs text-zinc-400">ยังไม่มีการ์ด</div>
              )}

              <form action={createCardAction} className="mt-1">
                <input type="hidden" name="listId" value={list.id} />
                <input
                  type="text"
                  name="title"
                  placeholder="+ Add card"
                  autoComplete="off"
                  className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none dark:text-zinc-200 dark:focus:border-zinc-600"
                />
              </form>
            </div>
          </div>
        ))}

        {board.lists.length === 0 && (
          <p className="text-sm text-zinc-500">ยังไม่มี list ในบอร์ดนี้</p>
        )}
      </div>

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
