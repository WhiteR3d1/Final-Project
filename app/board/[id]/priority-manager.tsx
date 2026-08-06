"use client";

import { useState } from "react";
import type { Priority } from "@/app/generated/prisma/client";
import { createPriorityAction, updatePriorityAction, deletePriorityAction } from "./actions";

export function PriorityManager({
  boardId,
  priorities,
}: {
  boardId: string;
  priorities: Priority[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">Priority</span>
      {priorities.map((priority) => (
        <PriorityChip key={priority.id} priority={priority} />
      ))}
      <form action={createPriorityAction} className="flex items-center gap-2">
        <input type="hidden" name="boardId" value={boardId} />
        <input
          type="text"
          name="name"
          placeholder="เพิ่ม priority"
          required
          className="w-28 rounded-md border border-black/10 bg-white px-2 py-1 text-xs focus:border-zinc-400 focus:outline-none dark:border-white/10 dark:bg-zinc-800"
        />
        <input
          type="color"
          name="color"
          defaultValue="#f59e0b"
          className="h-6 w-8 cursor-pointer rounded-md border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-800"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
        >
          + Priority
        </button>
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
          className="w-20 rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-xs focus:border-zinc-400 focus:outline-none dark:border-white/10 dark:bg-zinc-800"
        />
        <input
          type="color"
          name="color"
          defaultValue={priority.color}
          className="h-5 w-6 cursor-pointer rounded border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-800"
        />
        <button type="submit" className="text-xs text-emerald-600 dark:text-emerald-400">
          ✓
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          ✕
        </button>
      </form>
    );
  }

  return (
    <span className="group inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: priority.color }}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-zinc-700 dark:text-zinc-200"
      >
        {priority.name}
      </button>
      <form action={deletePriorityAction}>
        <input type="hidden" name="priorityId" value={priority.id} />
        <button
          type="submit"
          className="text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:text-zinc-600"
          aria-label={`ลบ priority ${priority.name}`}
        >
          ×
        </button>
      </form>
    </span>
  );
}
