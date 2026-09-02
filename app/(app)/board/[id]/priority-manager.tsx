"use client";

import { useState } from "react";
import type { Priority } from "@/app/generated/prisma/client";
import { ConfirmSubmitButton, SubmitButton } from "@/app/components/ui/buttons";
import { IconCheck, IconClose, IconPlus, IconTrash } from "@/app/components/ui/icons";
import { createPriorityAction, updatePriorityAction, deletePriorityAction } from "./actions";

const inputClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none";
const colorClass = "border-line bg-panel-2 h-7 w-9 cursor-pointer rounded-lg border";

export function PriorityManager({
  boardId,
  priorities,
}: {
  boardId: string;
  priorities: Priority[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {priorities.length === 0 && (
          <p className="text-muted text-xs">ยังไม่มีระดับความสำคัญในบอร์ดนี้</p>
        )}
        {priorities.map((priority) => (
          <PriorityChip key={priority.id} priority={priority} />
        ))}
      </div>

      <form action={createPriorityAction} className="flex items-center gap-1.5">
        <input type="hidden" name="boardId" value={boardId} />
        <input
          type="text"
          name="name"
          placeholder="เพิ่มระดับความสำคัญ"
          required
          className={`${inputClass} flex-1`}
        />
        <input type="color" name="color" defaultValue="#ffcc4d" className={colorClass} />
        <SubmitButton
          ariaLabel="เพิ่มระดับความสำคัญ"
          className="bg-panel-2 text-text hover:bg-line flex h-7 w-7 items-center justify-center rounded-lg"
        >
          <IconPlus size={14} />
        </SubmitButton>
      </form>
    </div>
  );
}

function PriorityChip({ priority }: { priority: Priority }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <form
        action={async (formData) => {
          await updatePriorityAction(formData);
          setIsEditing(false);
        }}
        className="flex items-center gap-1"
      >
        <input type="hidden" name="priorityId" value={priority.id} />
        <input
          type="text"
          name="name"
          defaultValue={priority.name}
          autoFocus
          className={`${inputClass} w-24`}
        />
        <input
          type="color"
          name="color"
          defaultValue={priority.color}
          className={colorClass}
        />
        <SubmitButton ariaLabel="บันทึก" className="text-accent p-1">
          <IconCheck size={14} />
        </SubmitButton>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          aria-label="ยกเลิก"
          className="text-muted hover:text-text p-1"
        >
          <IconClose size={14} />
        </button>
      </form>
    );
  }

  return (
    <span
      className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `${priority.color}22`, color: priority.color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priority.color }} />
      <button type="button" onClick={() => setIsEditing(true)}>
        {priority.name}
      </button>
      <form action={deletePriorityAction} className="flex">
        <input type="hidden" name="priorityId" value={priority.id} />
        <ConfirmSubmitButton
          ariaLabel={`ลบระดับความสำคัญ ${priority.name}`}
          confirmLabel="ลบ?"
          className="hover:text-danger focus-visible:opacity-100 opacity-0 group-hover:opacity-100"
          confirmClassName="text-danger font-medium"
        >
          <IconTrash size={12} />
        </ConfirmSubmitButton>
      </form>
    </span>
  );
}
