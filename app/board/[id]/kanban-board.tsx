"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Prisma, Label, User } from "@/app/generated/prisma/client";
import {
  createCardAction,
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
      };
    };
  };
}>;

type CardWithRelations = ListWithCards["cards"][number];

export function KanbanBoard({
  initialLists,
  boardLabels,
  boardMembers,
}: {
  initialLists: ListWithCards[];
  boardLabels: Label[];
  boardMembers: User[];
}) {
  const [lists, setLists] = useState(initialLists);
  const [activeCard, setActiveCard] = useState<CardWithRelations | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLists(initialLists);
  }, [initialLists]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    const cardId = String(event.active.id);
    const card = lists.flatMap((l) => l.cards).find((c) => c.id === cardId) ?? null;
    setActiveCard(card);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const cardId = String(active.id);
    const overId = String(over.id);
    if (cardId === overId) return;

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
      <div className="flex gap-4 overflow-x-auto pb-4">
        {lists.map((list, listIndex) => (
          <DroppableList key={list.id} listId={list.id} listName={list.name}>
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
                />
              ))}
            </SortableContext>

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
          </DroppableList>
        ))}

        {lists.length === 0 && (
          <p className="text-sm text-zinc-500">ยังไม่มี list ในบอร์ดนี้</p>
        )}
      </div>

      <DragOverlay>
        {activeCard && (
          <div className="w-72 rounded-md bg-white p-3 text-sm shadow-lg dark:bg-zinc-800">
            {activeCard.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableList({
  listId,
  listName,
  children,
}: {
  listId: string;
  listName: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: listId });

  return (
    <div
      ref={setNodeRef}
      className="w-72 shrink-0 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900"
    >
      <h2 className="mb-3 px-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {listName}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function SortableCard({
  card,
  listIndex,
  totalLists,
  boardLabels,
  boardMembers,
}: {
  card: CardWithRelations;
  listIndex: number;
  totalLists: number;
  boardLabels: Label[];
  boardMembers: User[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const items = card.checklists.flatMap((c) => c.items);
  const done = items.filter((i) => i.isCompleted).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md bg-white p-3 text-sm shadow-sm dark:bg-zinc-800"
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-zinc-400 active:cursor-grabbing"
          aria-label="ลากเพื่อย้ายการ์ด"
        >
          ⠿
        </button>
        <div className={card.isCompleted ? "line-through text-zinc-400" : ""}>
          {card.title}
        </div>
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

      {boardLabels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
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
                <button type="submit" className="text-xs text-zinc-400 hover:text-red-500">
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
        canMoveRight={listIndex < totalLists - 1}
      />
    </div>
  );
}
