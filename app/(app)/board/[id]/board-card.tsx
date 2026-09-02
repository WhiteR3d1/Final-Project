"use client";

import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DUE_BUCKET_STYLE, dueBucket, dueLabel, formatDueThai } from "@/lib/due";
import { AvatarStack } from "@/app/components/ui/avatar";
import { Chip } from "@/app/components/ui/chip";
import {
  IconCheck,
  IconChecklist,
  IconComment,
  IconFlag,
  IconGrip,
} from "@/app/components/ui/icons";
import type { CardWithRelations } from "./types";

/**
 * ระยะที่ต้องลากก่อนถึงจะนับว่า "เริ่มลาก" — ใช้ทั้งกับ PointerSensor ของบอร์ด
 * และกับตัวเช็คในการ์ดว่าคลิกครั้งนี้เป็นการคลิกเปิดหรือเพิ่งลากเสร็จ
 */
export const DRAG_THRESHOLD = 4;

/** การ์ดบนบอร์ด — โชว์เฉพาะข้อมูลสรุป รายละเอียดทั้งหมดอยู่ใน modal */
export function BoardCard({
  card,
  dragDisabled,
  onOpen,
}: {
  card: CardWithRelations;
  dragDisabled: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: dragDisabled,
  });

  const items = card.checklists.flatMap((checklist) => checklist.items);
  const doneItems = items.filter((item) => item.isCompleted).length;
  const dueStyle =
    card.dueDate && !card.isCompleted ? DUE_BUCKET_STYLE[dueBucket(card.dueDate)] : null;

  // จับตำแหน่งตอนกดไว้ เพื่อแยก "คลิกเพื่อเปิดการ์ด" ออกจาก "ลากแล้วปล่อย"
  const pressPoint = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pressPoint.current = { x: event.clientX, y: event.clientY };
    if (dragDisabled) return;
    // ปล่อยให้ปุ่มจับลากจัดการเอง ไม่งั้นจะเริ่มลากซ้อนกันสองที
    if ((event.target as HTMLElement).closest("[data-drag-handle]")) return;
    // กันไม่ให้คอลัมน์ที่ครอบอยู่เริ่มลากตามไปด้วย
    event.stopPropagation();
    listeners?.onPointerDown?.(event);
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-drag-handle]")) return;
    const start = pressPoint.current;
    pressPoint.current = null;
    // ขยับเกิน threshold = เพิ่งลากเสร็จ ไม่ใช่คลิก
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_THRESHOLD) {
      return;
    }
    onOpen();
  }

  return (
    <div
      ref={setNodeRef}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={`group/card border-line bg-panel hover:border-accent/40 rounded-xl border p-3 transition-colors ${
        dragDisabled ? "" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex items-start gap-1.5">
        {/* ปุ่มจับลากยังอยู่เพื่อการลากด้วยคีย์บอร์ด (เมาส์ลากตรงไหนของการ์ดก็ได้) */}
        <button
          type="button"
          data-drag-handle
          {...attributes}
          {...listeners}
          disabled={dragDisabled}
          aria-label="ลากเพื่อย้ายการ์ด"
          className="text-muted/50 hover:bg-panel-2 hover:text-muted focus-visible:opacity-100 mt-0.5 shrink-0 cursor-grab rounded p-0.5 opacity-0 group-hover/card:opacity-100 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-0"
        >
          <IconGrip size={14} />
        </button>

        {/* คลิกที่ไหนของการ์ดก็เปิดได้ ปุ่มนี้เหลือไว้เป็นจุดโฟกัสให้คีย์บอร์ดกด Enter */}
        <button
          type="button"
          className={`min-w-0 flex-1 text-left text-sm leading-snug ${
            card.isCompleted ? "text-muted line-through" : "text-text font-medium"
          }`}
        >
          {card.title}
        </button>
      </div>

      {card.labels.length > 0 && (
        <div className="mt-2 ml-6 flex flex-wrap gap-1">
          {card.labels.map(({ label }) => (
            <span
              key={label.id}
              title={label.name}
              className="h-1.5 w-6 rounded-full"
              style={{ backgroundColor: label.color }}
            />
          ))}
        </div>
      )}

      <div className="mt-2 ml-6 flex flex-wrap items-center gap-1.5">
        {card.isCompleted && (
          <Chip tone="accent">
            <IconCheck size={11} /> เสร็จแล้ว
          </Chip>
        )}
        {!card.isCompleted && card.completedAt && (
          <Chip
            tone="neutral"
            title="การ์ดใบนี้เคยทำเสร็จและได้แต้มไปแล้ว ทำเสร็จอีกครั้งจะไม่ได้แต้มเพิ่ม"
          >
            ได้แต้มแล้ว
          </Chip>
        )}
        {card.priority && (
          <Chip color={card.priority.color} title={`ระดับความสำคัญ: ${card.priority.name}`}>
            <IconFlag size={11} />
            {card.priority.name}
          </Chip>
        )}
        {card.dueDate && (
          <span
            title={dueLabel(card.dueDate)}
            className={`rounded-full px-2 py-0.5 text-[11px] leading-5 font-medium ${
              dueStyle ? dueStyle.chip : "bg-panel-2 text-muted"
            }`}
          >
            {formatDueThai(card.dueDate)}
            {dueStyle && dueBucket(card.dueDate) === "overdue" && " · เลยกำหนด"}
          </span>
        )}
      </div>

      {(items.length > 0 || card.comments.length > 0 || card.assignees.length > 0) && (
        <div className="mt-2 ml-6 flex items-center gap-3">
          {items.length > 0 && (
            <span className="text-muted flex items-center gap-1 text-[11px] tabular-nums">
              <IconChecklist size={12} />
              {doneItems}/{items.length}
            </span>
          )}
          {card.comments.length > 0 && (
            <span className="text-muted flex items-center gap-1 text-[11px] tabular-nums">
              <IconComment size={12} />
              {card.comments.length}
            </span>
          )}
          <span className="ml-auto">
            <AvatarStack users={card.assignees.map((assignee) => assignee.user)} size={22} />
          </span>
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-panel-2 mt-2 ml-6 h-1 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-all"
            style={{ width: `${(doneItems / items.length) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
