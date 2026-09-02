"use client";

import type { Priority, User } from "@/app/generated/prisma/client";
import { displayName } from "@/app/components/ui/avatar";
import { IconSearch } from "@/app/components/ui/icons";

export type BoardFilterState = {
  due: "all" | "overdue" | "today" | "soon";
  assigneeId: string;
  priorityId: string;
  query: string;
};

export const EMPTY_FILTERS: BoardFilterState = {
  due: "all",
  assigneeId: "all",
  priorityId: "all",
  query: "",
};

export function isFilterActive(filters: BoardFilterState) {
  return (
    filters.due !== "all" ||
    filters.assigneeId !== "all" ||
    filters.priorityId !== "all" ||
    filters.query.trim() !== ""
  );
}

const selectClass =
  "border-line bg-panel text-text focus:border-accent rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none";

export function BoardFilters({
  filters,
  onChange,
  members,
  priorities,
  visibleCount,
  totalCount,
}: {
  filters: BoardFilterState;
  onChange: (next: BoardFilterState) => void;
  members: User[];
  priorities: Priority[];
  visibleCount: number;
  totalCount: number;
}) {
  const active = isFilterActive(filters);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <span className="text-muted pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">
          <IconSearch size={14} />
        </span>
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="ค้นหาการ์ดในบอร์ด"
          aria-label="ค้นหาการ์ดในบอร์ด"
          className={`${selectClass} w-52 pl-7`}
        />
      </div>

      <select
        value={filters.due}
        onChange={(event) =>
          onChange({ ...filters, due: event.target.value as BoardFilterState["due"] })
        }
        aria-label="กรองตามกำหนดส่ง"
        className={selectClass}
      >
        <option value="all">กำหนดส่ง: ทั้งหมด</option>
        <option value="overdue">เลยกำหนด</option>
        <option value="today">ครบกำหนดวันนี้</option>
        <option value="soon">ภายใน 7 วัน</option>
      </select>

      <select
        value={filters.assigneeId}
        onChange={(event) => onChange({ ...filters, assigneeId: event.target.value })}
        aria-label="กรองตามผู้รับผิดชอบ"
        className={selectClass}
      >
        <option value="all">ผู้รับผิดชอบ: ทั้งหมด</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {displayName(member)}
          </option>
        ))}
      </select>

      <select
        value={filters.priorityId}
        onChange={(event) => onChange({ ...filters, priorityId: event.target.value })}
        aria-label="กรองตามระดับความสำคัญ"
        className={selectClass}
      >
        <option value="all">ความสำคัญ: ทั้งหมด</option>
        {priorities.map((priority) => (
          <option key={priority.id} value={priority.id}>
            {priority.name}
          </option>
        ))}
      </select>

      {active && (
        <>
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-muted hover:text-text rounded-lg px-2 py-1.5 text-xs underline"
          >
            ล้างตัวกรอง
          </button>
          <span className="bg-warn/15 text-warn rounded-lg px-2.5 py-1.5 text-xs">
            แสดง {visibleCount}/{totalCount} การ์ด · ปิดการลากชั่วคราวระหว่างกรอง
          </span>
        </>
      )}
    </div>
  );
}
