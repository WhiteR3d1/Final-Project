"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Prisma, Label, Priority, User } from "@/app/generated/prisma/client";
import {
  createListAction,
  renameListAction,
  deleteListAction,
  reorderListAction,
  createCardAction,
  updateCardAction,
  setCardPriorityAction,
  deleteCardAction,
  createChecklistAction,
  addChecklistItemAction,
  toggleChecklistItemAction,
  deleteChecklistItemAction,
  addCommentAction,
  toggleCardLabelAction,
  toggleCardAssigneeAction,
  reorderCardAction,
} from "./actions";
import { CardMoveButtons } from "./card-move-buttons";

type ListWithCards = Prisma.ListGetPayload<{
  include: {
    cards: {
      include: {
        checklists: { include: { items: true } };
        comments: { include: { user: true } };
        labels: { include: { label: true } };
        assignees: { include: { user: true } };
        priority: true;
      };
    };
  };
}>;

type CardWithRelations = ListWithCards["cards"][number];

const LIST_ACCENTS = [
  { bar: "bg-sky-400", chip: "text-sky-600 dark:text-sky-300" },
  { bar: "bg-amber-400", chip: "text-amber-600 dark:text-amber-300" },
  { bar: "bg-emerald-400", chip: "text-emerald-600 dark:text-emerald-300" },
  { bar: "bg-rose-400", chip: "text-rose-600 dark:text-rose-300" },
  { bar: "bg-violet-400", chip: "text-violet-600 dark:text-violet-300" },
];

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="2.5" r="1.5" />
      <circle cx="7.5" cy="2.5" r="1.5" />
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="7.5" cy="8" r="1.5" />
      <circle cx="2.5" cy="13.5" r="1.5" />
      <circle cx="7.5" cy="13.5" r="1.5" />
    </svg>
  );
}

export function KanbanBoard({
  boardId,
  initialLists,
  boardLabels,
  boardMembers,
  boardPriorities,
}: {
  boardId: string;
  initialLists: ListWithCards[];
  boardLabels: Label[];
  boardMembers: User[];
  boardPriorities: Priority[];
}) {
  const [lists, setLists] = useState(initialLists);
  const [activeCard, setActiveCard] = useState<CardWithRelations | null>(null);
  const [activeList, setActiveList] = useState<ListWithCards | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLists(initialLists);
  }, [initialLists]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    const list = lists.find((l) => l.id === activeId);
    if (list) {
      setActiveList(list);
      setActiveCard(null);
      return;
    }
    setActiveCard(lists.flatMap((l) => l.cards).find((c) => c.id === activeId) ?? null);
    setActiveList(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const wasDraggingList = activeList !== null;
    setActiveCard(null);
    setActiveList(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    if (wasDraggingList) {
      const oldIndex = lists.findIndex((l) => l.id === activeId);
      const newIndex = lists.findIndex((l) => l.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(lists, oldIndex, newIndex);
      const prevList = reordered[newIndex - 1];
      const nextList = reordered[newIndex + 1];

      let newPosition: number;
      if (prevList && nextList) newPosition = (prevList.position + nextList.position) / 2;
      else if (nextList) newPosition = nextList.position - 1;
      else if (prevList) newPosition = prevList.position + 1;
      else newPosition = 1;

      setLists(
        reordered.map((l) => (l.id === activeId ? { ...l, position: newPosition } : l))
      );

      startTransition(() => {
        reorderListAction(activeId, newPosition);
      });
      return;
    }

    const cardId = activeId;
    const sourceListIndex = lists.findIndex((l) => l.cards.some((c) => c.id === cardId));
    if (sourceListIndex === -1) return;
    const card = lists[sourceListIndex].cards.find((c) => c.id === cardId);
    if (!card) return;

    const overIsList = lists.some((l) => l.id === overId);
    const destListIndex = overIsList
      ? lists.findIndex((l) => l.id === overId)
      : lists.findIndex((l) => l.cards.some((c) => c.id === overId));
    if (destListIndex === -1) return;

    const destList = lists[destListIndex];
    const destCardsWithoutDragged = destList.cards.filter((c) => c.id !== cardId);
    const destIndex = overIsList
      ? destCardsWithoutDragged.length
      : destCardsWithoutDragged.findIndex((c) => c.id === overId);

    const before = destIndex > 0 ? destCardsWithoutDragged[destIndex - 1] : undefined;
    const after = destCardsWithoutDragged[destIndex];

    let newPosition: number;
    if (before && after) newPosition = (before.position + after.position) / 2;
    else if (after) newPosition = after.position - 1;
    else if (before) newPosition = before.position + 1;
    else newPosition = 1;

    setLists((prev) =>
      prev.map((l) => {
        if (l.id === destList.id) {
          const withoutDragged = l.cards.filter((c) => c.id !== cardId);
          const updatedCard = { ...card, listId: destList.id, position: newPosition };
          return {
            ...l,
            cards: [
              ...withoutDragged.slice(0, destIndex),
              updatedCard,
              ...withoutDragged.slice(destIndex),
            ],
          };
        }
        if (l.id === lists[sourceListIndex].id) {
          return { ...l, cards: l.cards.filter((c) => c.id !== cardId) };
        }
        return l;
      })
    );

    startTransition(() => {
      reorderCardAction(cardId, destList.id, newPosition);
    });
  }

  return (
    <DndContext
      id="kanban-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-start gap-5 overflow-x-auto pb-4">
        <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
          {lists.map((list, listIndex) => {
            const accent = LIST_ACCENTS[listIndex % LIST_ACCENTS.length];
            return (
              <SortableList key={list.id} list={list} accent={accent}>
                <SortableContext
                  items={list.cards.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {list.cards.map((card) => (
                    <SortableCard
                      key={card.id}
                      card={card}
                      listIndex={listIndex}
                      totalLists={lists.length}
                      boardLabels={boardLabels}
                      boardMembers={boardMembers}
                      boardPriorities={boardPriorities}
                    />
                  ))}
                </SortableContext>

                {list.cards.length === 0 && (
                  <div className="rounded-lg border border-dashed border-black/10 px-3 py-4 text-center text-xs text-zinc-400 dark:border-white/10">
                    ยังไม่มีการ์ด
                  </div>
                )}

                <form action={createCardAction} className="mt-1">
                  <input type="hidden" name="listId" value={list.id} />
                  <input
                    type="text"
                    name="title"
                    placeholder="+ Add card"
                    autoComplete="off"
                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-zinc-700 placeholder:text-zinc-400 hover:bg-black/5 focus:border-zinc-300 focus:bg-white focus:outline-none dark:text-zinc-200 dark:hover:bg-white/5 dark:focus:border-zinc-600 dark:focus:bg-zinc-800"
                  />
                </form>
              </SortableList>
            );
          })}
        </SortableContext>

        <div className="w-72 shrink-0">
          <form
            action={createListAction}
            className="rounded-xl border border-dashed border-black/10 p-3 dark:border-white/10"
          >
            <input type="hidden" name="boardId" value={boardId} />
            <input
              type="text"
              name="name"
              placeholder="+ Add list"
              autoComplete="off"
              className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-zinc-700 placeholder:text-zinc-400 hover:bg-black/5 focus:border-zinc-300 focus:bg-white focus:outline-none dark:text-zinc-200 dark:hover:bg-white/5 dark:focus:border-zinc-600 dark:focus:bg-zinc-800"
            />
          </form>
        </div>

        {lists.length === 0 && (
          <p className="text-sm text-zinc-500">ยังไม่มี list ในบอร์ดนี้</p>
        )}
      </div>

      <DragOverlay>
        {activeCard && (
          <div className="w-72 rotate-2 rounded-xl bg-white p-3.5 text-sm shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
            {activeCard.title}
          </div>
        )}
        {activeList && (
          <div className="w-72 rotate-1 rounded-xl bg-zinc-100 p-3 text-sm font-semibold text-zinc-700 shadow-xl ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-white/10">
            {activeList.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function SortableList({
  list,
  accent,
  children,
}: {
  list: ListWithCards;
  accent: { bar: string; chip: string };
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(list.name);
  const [, startTransition] = useTransition();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function commitRename() {
    setIsEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== list.name) {
      startTransition(() => {
        renameListAction(list.id, trimmed);
      });
    } else {
      setNameDraft(list.name);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/list flex w-72 shrink-0 flex-col overflow-hidden rounded-xl bg-zinc-100 shadow-sm dark:bg-zinc-900"
    >
      <div className={`h-1 ${accent.bar}`} />
      <div className="flex flex-col gap-2 p-3">
        <div className="mb-1 flex items-center gap-1 px-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab rounded p-0.5 text-zinc-300 hover:bg-black/5 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-600 dark:hover:bg-white/10 dark:hover:text-zinc-300"
            aria-label="ลากเพื่อย้ายคอลัมน์"
          >
            <GripIcon />
          </button>

          {isEditingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                }
                if (e.key === "Escape") {
                  setNameDraft(list.name);
                  setIsEditingName(false);
                }
              }}
              className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-sm font-semibold focus:outline-none dark:border-zinc-600 dark:bg-zinc-800"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(list.name);
                setIsEditingName(true);
              }}
              className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-zinc-700 dark:text-zinc-200"
            >
              {list.name}
            </button>
          )}

          <span
            className={`shrink-0 rounded-full bg-white px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800 ${accent.chip}`}
          >
            {list.cards.length}
          </span>

          <form action={deleteListAction} className="shrink-0">
            <input type="hidden" name="listId" value={list.id} />
            <button
              type="submit"
              className="rounded px-1 text-xs text-zinc-300 opacity-0 hover:text-red-500 group-hover/list:opacity-100 dark:text-zinc-600"
              aria-label={`ลบ list ${list.name}`}
            >
              ×
            </button>
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}

function SortableCard({
  card,
  listIndex,
  totalLists,
  boardLabels,
  boardMembers,
  boardPriorities,
}: {
  card: CardWithRelations;
  listIndex: number;
  totalLists: number;
  boardLabels: Label[];
  boardMembers: User[];
  boardPriorities: Priority[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  const [isEditing, setIsEditing] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const items = card.checklists.flatMap((c) => c.items);
  const done = items.filter((i) => i.isCompleted).length;
  const progress = items.length > 0 ? (done / items.length) * 100 : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/card rounded-xl border border-black/5 bg-white p-3.5 text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-white/5 dark:bg-zinc-800"
    >
      {isEditing ? (
        <form
          action={async (formData) => {
            await updateCardAction(formData);
            setIsEditing(false);
          }}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="cardId" value={card.id} />
          <input
            type="text"
            name="title"
            defaultValue={card.title}
            required
            autoFocus
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm font-medium focus:outline-none dark:border-zinc-600 dark:bg-zinc-900"
          />
          <textarea
            name="description"
            defaultValue={card.description ?? ""}
            placeholder="รายละเอียด..."
            rows={2}
            className="w-full resize-none rounded border border-zinc-300 bg-white px-2 py-1 text-xs focus:outline-none dark:border-zinc-600 dark:bg-zinc-900"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              name="priorityId"
              defaultValue={card.priorityId ?? ""}
              className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs focus:outline-none dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="">— priority —</option>
              {boardPriorities.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="dueDate"
              defaultValue={card.dueDate ? card.dueDate.toISOString().slice(0, 10) : ""}
              className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs focus:outline-none dark:border-zinc-600 dark:bg-zinc-900"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
            >
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-md px-2.5 py-1 text-xs text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-zinc-300 hover:bg-black/5 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-600 dark:hover:bg-white/10 dark:hover:text-zinc-300"
              aria-label="ลากเพื่อย้ายการ์ด"
            >
              <GripIcon />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={
                card.isCompleted
                  ? "flex-1 text-left leading-snug text-zinc-400 line-through"
                  : "flex-1 text-left leading-snug font-medium text-zinc-800 dark:text-zinc-100"
              }
            >
              {card.title}
            </button>
          </div>

          {boardPriorities.length > 0 && (
            <div className="mt-1.5 ml-6 flex flex-wrap items-center gap-1">
              {boardPriorities.map((priority) => {
                const isActive = card.priorityId === priority.id;
                return (
                  <form key={priority.id} action={setCardPriorityAction}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <input type="hidden" name="priorityId" value={priority.id} />
                    <button
                      type="submit"
                      title={isActive ? `เอา priority "${priority.name}" ออก` : `ตั้ง priority เป็น "${priority.name}"`}
                      style={
                        isActive
                          ? { backgroundColor: `${priority.color}22`, color: priority.color }
                          : undefined
                      }
                      className={
                        isActive
                          ? "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          : "inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-400 dark:border-zinc-600"
                      }
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: isActive ? priority.color : "transparent", border: isActive ? undefined : `1px solid ${priority.color}` }}
                      />
                      {priority.name}
                    </button>
                  </form>
                );
              })}
            </div>
          )}

          {(items.length > 0 || card.dueDate) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              {items.length > 0 && (
                <span className="tabular-nums">
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
          )}

          {items.length > 0 && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {boardLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {boardLabels.map((label) => {
                const isAssigned = card.labels.some((cl) => cl.labelId === label.id);
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
                      className="h-3.5 w-3.5 rounded-full border-2 transition-transform hover:scale-110"
                    />
                  </form>
                );
              })}
            </div>
          )}

          {boardMembers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {boardMembers.map((member) => {
                const isAssigned = card.assignees.some((a) => a.userId === member.id);
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
                          ? "flex h-5.5 w-5.5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-medium text-white ring-2 ring-indigo-100 dark:ring-indigo-950"
                          : "flex h-5.5 w-5.5 items-center justify-center rounded-full border border-dashed border-zinc-300 text-[10px] text-zinc-400 hover:border-zinc-400 dark:border-zinc-600"
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
                <div key={item.id} className="group flex items-center gap-1.5">
                  <form action={toggleChecklistItemAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button
                      type="submit"
                      className={
                        item.isCompleted ? "text-xs text-emerald-500" : "text-xs text-zinc-400"
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
                      className="text-xs text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:text-zinc-600"
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

          <div className="mt-2.5 flex flex-col gap-1 border-t border-black/5 pt-2.5 dark:border-white/5">
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

          <div className="mt-2 flex items-center justify-between">
            <CardMoveButtons
              cardId={card.id}
              canMoveLeft={listIndex > 0}
              canMoveRight={listIndex < totalLists - 1}
            />
            <form action={deleteCardAction}>
              <input type="hidden" name="cardId" value={card.id} />
              <button
                type="submit"
                className="rounded px-1.5 py-0.5 text-xs text-zinc-400 opacity-0 group-hover/card:opacity-100 hover:text-red-500 dark:text-zinc-500"
              >
                ลบการ์ด
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
