"use client";

import { useMemo, useState, useTransition } from "react";
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
import type { Label, Priority } from "@/app/generated/prisma/client";
import { dueBucket } from "@/lib/due";
import { clampBeforeDone, positionBetween, resolveListDropTarget } from "@/lib/drag";
import { Toast } from "@/app/components/ui/toast";
import { IconGrip, IconPlus } from "@/app/components/ui/icons";
import { reorderListAction, reorderCardAction } from "./actions";
import { BoardCard, DRAG_THRESHOLD } from "./board-card";
import { CardDetailDialog } from "./card-detail-dialog";
import { CardCreateDialog } from "./card-create-dialog";
import { ListDialog } from "./list-dialog";
import { ListMenu } from "./list-menu";
import {
  BoardFilters,
  EMPTY_FILTERS,
  isFilterActive,
  type BoardFilterState,
} from "./board-filters";
import type { CardWithRelations, ListWithCards, PublicUser } from "./types";

const LIST_ACCENTS = ["bg-info", "bg-warn", "bg-accent", "bg-danger", "bg-info"];

const REVIEW_REQUIRED_NOTICE = "ต้องให้อาจารย์ตรวจก่อน การ์ดถึงจะเข้าคอลัมน์เสร็จสิ้นได้";

/** หน้าต่างคอลัมน์: สร้างใหม่ (แทรกข้าง anchor ได้) หรือแก้ไขคอลัมน์เดิม */
type ListDialogState =
  | { mode: "new"; anchorId?: string; side?: "before" | "after" }
  | { mode: "edit"; listId: string };

export function KanbanBoard({
  boardId,
  initialLists,
  boardLabels,
  boardMembers,
  boardPriorities,
  canEdit,
  canReview,
  requiresApproval,
  inCourse,
}: {
  boardId: string;
  initialLists: ListWithCards[];
  boardLabels: Label[];
  boardMembers: PublicUser[];
  boardPriorities: Priority[];
  canEdit: boolean;
  /** อาจารย์ของรายวิชา — พาการ์ดเข้าคอลัมน์เสร็จสิ้นได้แม้บอร์ดจะต้องรออนุมัติ */
  canReview: boolean;
  /** ผูกรายวิชา + มีคอลัมน์ตรวจ (คำนวณที่ assertBoardAccess) */
  requiresApproval: boolean;
  /** บอร์ดในรายวิชา — การ์ดที่ตรวจแล้วและคอลัมน์ที่มีการ์ดแบบนั้นลบไม่ได้ */
  inCourse: boolean;
}) {
  const [lists, setLists] = useState(initialLists);
  const [activeCard, setActiveCard] = useState<CardWithRelations | null>(null);
  const [activeList, setActiveList] = useState<ListWithCards | null>(null);
  const [reward, setReward] = useState<{ key: number; points: number } | null>(null);
  const [notice, setNotice] = useState<{ key: number; message: string } | null>(null);
  const [filters, setFilters] = useState<BoardFilterState>(EMPTY_FILTERS);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [syncedLists, setSyncedLists] = useState(initialLists);
  const [listDialog, setListDialog] = useState<ListDialogState | null>(null);
  const [addCardListId, setAddCardListId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ซิงก์ props ที่เพิ่ง revalidate มาลง state ระหว่าง render (แพตเทิร์นที่ React แนะนำ)
  // แทนการ setState ใน useEffect ซึ่งทำให้ render ซ้ำรอบ
  if (syncedLists !== initialLists) {
    setSyncedLists(initialLists);
    setLists(initialLists);
  }

  function celebrate(points: number) {
    if (points <= 0) return;
    const key = Date.now();
    setReward({ key, points });
    setTimeout(() => setReward((current) => (current?.key === key ? null : current)), 2500);
  }

  function warn(message: string) {
    const key = Date.now();
    setNotice({ key, message });
    setTimeout(() => setNotice((current) => (current?.key === key ? null : current)), 3500);
  }

  // บอร์ดในรายวิชาที่มีคอลัมน์ตรวจ = การ์ดเข้าคอลัมน์เสร็จสิ้นได้ต่อเมื่ออาจารย์อนุมัติ (ด่านจริงอยู่ฝั่ง action)
  const blockedFromDone = requiresApproval && !canReview;

  const filtering = isFilterActive(filters);
  // ลากไม่ได้ทั้งตอนกรอง (ตำแหน่งเพื่อนบ้านเพี้ยน) และตอนเป็น viewer
  const dragDisabled = filtering || !canEdit;

  const visibleLists = useMemo(() => {
    if (!filtering) return lists;
    const query = filters.query.trim().toLowerCase();

    return lists.map((list) => ({
      ...list,
      cards: list.cards.filter((card) => {
        if (query && !card.title.toLowerCase().includes(query)) return false;
        if (filters.priorityId !== "all" && card.priorityId !== filters.priorityId) return false;
        if (
          filters.assigneeId !== "all" &&
          !card.assignees.some((assignee) => assignee.userId === filters.assigneeId)
        ) {
          return false;
        }
        if (filters.due !== "all") {
          if (!card.dueDate || card.isCompleted) return false;
          const bucket = dueBucket(card.dueDate);
          if (filters.due === "soon" && bucket === "later") return false;
          if (filters.due !== "soon" && bucket !== filters.due) return false;
        }
        return true;
      }),
    }));
  }, [lists, filters, filtering]);

  const totalCards = lists.reduce((sum, list) => sum + list.cards.length, 0);
  const visibleCards = visibleLists.reduce((sum, list) => sum + list.cards.length, 0);

  const openCard = openCardId
    ? lists.flatMap((list) => list.cards).find((card) => card.id === openCardId)
    : undefined;
  const openCardListIndex = openCard
    ? lists.findIndex((list) => list.id === openCard.listId)
    : -1;

  const editingList =
    listDialog?.mode === "edit" ? lists.find((list) => list.id === listDialog.listId) : undefined;
  const addCardList = addCardListId
    ? lists.find((list) => list.id === addCardListId)
    : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    const list = lists.find((item) => item.id === activeId);
    if (list) {
      setActiveList(list);
      setActiveCard(null);
      return;
    }
    setActiveCard(lists.flatMap((item) => item.cards).find((card) => card.id === activeId) ?? null);
    setActiveList(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const wasDraggingList = activeList !== null;
    setActiveCard(null);
    setActiveList(null);
    // ระหว่างกรองอยู่ ตำแหน่งที่คำนวณจากเพื่อนบ้านจะเพี้ยน เพราะการ์ดบางใบถูกซ่อน
    if (!over || filtering) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    if (wasDraggingList) {
      // closestCorners มักเลือกการ์ดในคอลัมน์ปลายทางเป็น over ไม่ใช่ตัวคอลัมน์
      // ถ้าเทียบ id ตรง ๆ จะหาไม่เจอแล้วเงียบ คอลัมน์เลยเด้งกลับที่เดิม
      const overListId = resolveListDropTarget(lists, activeId, overId);
      if (!overListId) return;

      const oldIndex = lists.findIndex((list) => list.id === activeId);
      const overIndex = lists.findIndex((list) => list.id === overListId);
      if (oldIndex === -1 || overIndex === -1) return;
      // คอลัมน์เสร็จสิ้นต้องอยู่ขวาสุดเสมอ ลากไปทับมันได้แค่ช่องก่อนหน้า
      const newIndex = clampBeforeDone(lists, oldIndex, overIndex);
      if (newIndex === oldIndex) return;

      const reordered = arrayMove(lists, oldIndex, newIndex);
      const newPosition = positionBetween(
        reordered[newIndex - 1]?.position,
        reordered[newIndex + 1]?.position
      );

      setLists(
        reordered.map((list) => (list.id === activeId ? { ...list, position: newPosition } : list))
      );

      startTransition(() => {
        reorderListAction(activeId, newPosition);
      });
      return;
    }

    const cardId = activeId;
    const sourceListIndex = lists.findIndex((list) => list.cards.some((c) => c.id === cardId));
    if (sourceListIndex === -1) return;
    const card = lists[sourceListIndex].cards.find((c) => c.id === cardId);
    if (!card) return;

    const overIsList = lists.some((list) => list.id === overId);
    const destListIndex = overIsList
      ? lists.findIndex((list) => list.id === overId)
      : lists.findIndex((list) => list.cards.some((c) => c.id === overId));
    if (destListIndex === -1) return;

    const destList = lists[destListIndex];
    if (blockedFromDone && destList.isDoneList && destListIndex !== sourceListIndex) {
      warn(REVIEW_REQUIRED_NOTICE);
      return;
    }
    const destCardsWithoutDragged = destList.cards.filter((c) => c.id !== cardId);
    const destIndex = overIsList
      ? destCardsWithoutDragged.length
      : destCardsWithoutDragged.findIndex((c) => c.id === overId);

    const before = destIndex > 0 ? destCardsWithoutDragged[destIndex - 1] : undefined;
    const after = destCardsWithoutDragged[destIndex];
    const newPosition = positionBetween(before?.position, after?.position);

    setLists((prev) =>
      prev.map((list) => {
        if (list.id === destList.id) {
          const withoutDragged = list.cards.filter((c) => c.id !== cardId);
          // เดาผลล่วงหน้า: ลากเข้าคอลัมน์เสร็จสิ้น = เสร็จ, ลากออก = กลับมากำลังทำ
          const updatedCard = {
            ...card,
            listId: destList.id,
            position: newPosition,
            isCompleted: destList.isDoneList,
          };
          return {
            ...list,
            cards: [
              ...withoutDragged.slice(0, destIndex),
              updatedCard,
              ...withoutDragged.slice(destIndex),
            ],
          };
        }
        if (list.id === lists[sourceListIndex].id) {
          return { ...list, cards: list.cards.filter((c) => c.id !== cardId) };
        }
        return list;
      })
    );

    startTransition(async () => {
      const result = await reorderCardAction(cardId, destList.id, newPosition);
      if (result && "error" in result) {
        // action ปฏิเสธ = ไม่มี revalidate มาแก้ state ให้ ต้องย้อน optimistic update เอง
        setLists(initialLists);
        warn(result.error);
        return;
      }
      if (result?.awarded) celebrate(result.awarded);
    });
  }

  return (
    <>
      <BoardFilters
        filters={filters}
        onChange={setFilters}
        members={boardMembers}
        priorities={boardPriorities}
        visibleCount={visibleCards}
        totalCount={totalCards}
      />

      <DndContext
        id="kanban-board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* คอลัมน์สูงเต็มจอเพื่อให้บอร์ดกินพื้นที่ก่อน ส่วนกิจกรรมล่าสุดจึงตกไปอยู่ใต้ fold */}
        <div className="flex h-[calc(100vh-20rem)] min-h-100 items-stretch gap-4 overflow-x-auto pb-4">
          <SortableContext
            items={visibleLists.map((list) => list.id)}
            strategy={horizontalListSortingStrategy}
          >
            {visibleLists.map((list, listIndex) => (
              <SortableList
                key={list.id}
                list={list}
                accent={LIST_ACCENTS[listIndex % LIST_ACCENTS.length]}
                dragDisabled={dragDisabled}
                canEdit={canEdit}
                deleteLocked={inCourse && list.cards.some((card) => card.review)}
                // ปุ่ม + ระหว่างคอลัมน์: มีเฉพาะช่องที่อยู่ระหว่างสองคอลัมน์จริง ไม่มีทางขวาของคอลัมน์เสร็จสิ้น
                // (อยู่ขวาสุดเสมอ) และซ่อนระหว่างลาก ไม่ให้เกะกะเป้าที่ปล่อย
                insertAfterLabel={
                  canEdit &&
                  !list.isDoneList &&
                  listIndex < visibleLists.length - 1 &&
                  !activeCard &&
                  !activeList
                    ? `เพิ่มคอลัมน์ระหว่าง ${list.name} กับ ${visibleLists[listIndex + 1].name}`
                    : undefined
                }
                onEdit={() => setListDialog({ mode: "edit", listId: list.id })}
                onInsert={(side) => setListDialog({ mode: "new", anchorId: list.id, side })}
                onAddCard={() => setAddCardListId(list.id)}
              >
                <SortableContext
                  items={list.cards.map((card) => card.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {list.cards.map((card) => (
                    <BoardCard
                      key={card.id}
                      card={card}
                      dragDisabled={dragDisabled}
                      onOpen={() => setOpenCardId(card.id)}
                    />
                  ))}
                </SortableContext>

                {list.cards.length === 0 && (
                  <p className="border-line text-muted rounded-xl border border-dashed px-3 py-5 text-center text-xs">
                    {filtering ? "ไม่มีการ์ดที่ตรงกับตัวกรอง" : "ยังไม่มีการ์ดในคอลัมน์นี้"}
                  </p>
                )}
              </SortableList>
            ))}
          </SortableContext>

          {canEdit && (
            <button
              type="button"
              onClick={() => setListDialog({ mode: "new" })}
              className="border-line text-muted hover:text-text hover:border-accent flex w-72 shrink-0 items-center justify-center gap-1.5 self-start rounded-2xl border border-dashed px-3 py-3 text-sm"
            >
              <IconPlus size={16} /> เพิ่มคอลัมน์
            </button>
          )}

          {lists.length === 0 && (
            <p className="text-muted self-start text-sm">ยังไม่มีคอลัมน์ในบอร์ดนี้</p>
          )}
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="border-line bg-panel w-72 rotate-2 rounded-xl border p-3 text-sm shadow-xl">
              {activeCard.title}
            </div>
          )}
          {activeList && (
            <div className="border-line bg-panel-2 text-text w-72 rotate-1 rounded-xl border p-3 text-sm font-semibold shadow-xl">
              {activeList.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {openCard && openCardListIndex >= 0 && (
        <CardDetailDialog
          card={openCard}
          listName={lists[openCardListIndex].name}
          listIndex={openCardListIndex}
          totalLists={lists.length}
          boardLabels={boardLabels}
          boardMembers={boardMembers}
          boardPriorities={boardPriorities}
          canEdit={canEdit}
          moveRightBlocked={
            blockedFromDone && Boolean(lists[openCardListIndex + 1]?.isDoneList)
          }
          deleteLocked={inCourse && Boolean(openCard.review)}
          onClose={() => setOpenCardId(null)}
          onAwarded={celebrate}
          onError={warn}
        />
      )}

      {listDialog && (
        <ListDialog
          boardId={boardId}
          list={editingList}
          anchor={
            listDialog.mode === "new" && listDialog.anchorId
              ? {
                  listId: listDialog.anchorId,
                  side: listDialog.side ?? "after",
                  name: lists.find((list) => list.id === listDialog.anchorId)?.name ?? "",
                }
              : undefined
          }
          onClose={() => setListDialog(null)}
        />
      )}

      {addCardList && (
        <CardCreateDialog
          listId={addCardList.id}
          listName={addCardList.name}
          priorities={boardPriorities}
          labels={boardLabels}
          members={boardMembers}
          onClose={() => setAddCardListId(null)}
        />
      )}

      {reward && <Toast>+{reward.points} แต้ม! 🎉</Toast>}
      {notice && !reward && <Toast tone="warn">{notice.message}</Toast>}
    </>
  );
}

function SortableList({
  list,
  accent,
  dragDisabled,
  canEdit,
  deleteLocked,
  insertAfterLabel,
  onEdit,
  onInsert,
  onAddCard,
  children,
}: {
  list: ListWithCards;
  accent: string;
  dragDisabled: boolean;
  canEdit: boolean;
  deleteLocked: boolean;
  /** มีค่า = โชว์ปุ่ม + ในช่องว่างทางขวาของคอลัมน์นี้ (ค่าคือ aria-label) */
  insertAfterLabel?: string;
  onEdit: () => void;
  onInsert: (side: "before" | "after") => void;
  onAddCard: () => void;
  children: React.ReactNode;
}) {
  // คอลัมน์เสร็จสิ้นติดขวาสุดเสมอ จึงลากตัวมันเองไม่ได้ (การ์ดข้างในยังลากได้ตามปกติ)
  const listDragDisabled = dragDisabled || list.isDoneList;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    disabled: listDragDisabled,
  });

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (listDragDisabled) return;
    const target = event.target as HTMLElement;
    // ช่องกรอกกับเมนูต้องใช้งานได้ตามปกติ ห้ามกลายเป็นการลากคอลัมน์
    if (target.closest("input, textarea, select, button, [data-no-drag]")) return;
    if (target.closest("[data-drag-handle]")) return;
    listeners?.onPointerDown?.(event);
  }

  return (
    <div
      ref={setNodeRef}
      onPointerDown={handlePointerDown}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="group/list border-line bg-panel-2 relative flex h-full w-72 shrink-0 flex-col gap-2 rounded-2xl border p-3"
    >
      {/* อยู่ในคอลัมน์แต่ยื่นไปกลางช่องว่าง gap-4 — ถ้าวางเป็น element แยกระหว่างคอลัมน์
          ใน SortableContext ตัวคำนวณการเลื่อนตอนลาก (horizontalListSortingStrategy) จะเพี้ยน */}
      {insertAfterLabel && (
        <button
          type="button"
          onClick={() => onInsert("after")}
          aria-label={insertAfterLabel}
          title={insertAfterLabel}
          className="border-line bg-panel text-muted hover:text-accent hover:border-accent focus-visible:text-accent absolute top-1/2 -right-[22px] z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border opacity-60 shadow-sm transition hover:opacity-100 focus-visible:opacity-100"
        >
          <IconPlus size={14} />
        </button>
      )}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* ปุ่มจับลากยังอยู่เพื่อการลากด้วยคีย์บอร์ด (เมาส์ลากที่พื้นว่างของคอลัมน์ก็ได้) */}
        {canEdit && (
        <button
          type="button"
          data-drag-handle
          {...attributes}
          {...listeners}
          disabled={listDragDisabled}
          aria-label="ลากเพื่อย้ายคอลัมน์"
          className="text-muted/50 hover:bg-panel hover:text-muted focus-visible:opacity-100 shrink-0 cursor-grab rounded p-0.5 opacity-0 group-hover/list:opacity-100 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-0"
        >
          <IconGrip size={14} />
        </button>
        )}

        {(() => {
          const chipClass = `inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-2.5 py-1 text-left text-xs font-semibold ${
            list.isDoneList ? "bg-accent/15 text-accent" : "bg-panel text-text"
          }`;
          const inner = (
            <>
              {/* สีที่ผู้ใช้ตั้งเองเก็บใน DB จึงใส่ผ่าน style ไม่ใช่ token */}
              <span
                style={list.color && !list.isDoneList ? { backgroundColor: list.color } : undefined}
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  list.isDoneList ? "bg-accent" : list.color ? "" : accent
                }`}
              />
              <span className="truncate">{list.name}</span>
              {list.isDoneList && <span className="shrink-0 opacity-80">· เสร็จสิ้น</span>}
              {list.isReviewList && <span className="shrink-0 opacity-80">· ตรวจสอบ</span>}
            </>
          );

          return canEdit ? (
            <button type="button" onClick={onEdit} title="แก้ไขคอลัมน์" className={chipClass}>
              {inner}
            </button>
          ) : (
            <span className={chipClass}>{inner}</span>
          );
        })()}

        <span className="text-muted shrink-0 text-xs tabular-nums">{list.cards.length}</span>

        {canEdit && (
          <ListMenu
            listId={list.id}
            listName={list.name}
            isDoneList={list.isDoneList}
            isReviewList={list.isReviewList}
            deleteLocked={deleteLocked}
            onEdit={onEdit}
            onInsert={onInsert}
          />
        )}
      </div>

      {list.description && (
        <p className="text-muted line-clamp-2 shrink-0 px-1 text-[11px] leading-4">
          {list.description}
        </p>
      )}

      {/* การ์ดเลื่อนอยู่ในคอลัมน์ ปุ่มเพิ่มการ์ดจึงติดล่างคอลัมน์เสมอ */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
        {children}
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={onAddCard}
          className="text-muted hover:bg-panel hover:text-text flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm"
        >
          <IconPlus size={14} /> เพิ่มการ์ด
        </button>
      )}
    </div>
  );
}
