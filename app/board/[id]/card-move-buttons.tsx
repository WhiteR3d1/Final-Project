"use client";

import { useTransition } from "react";
import { moveCardAction } from "./actions";

export function CardMoveButtons({
  cardId,
  canMoveLeft,
  canMoveRight,
}: {
  cardId: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-2 flex gap-1">
      <button
        type="button"
        disabled={!canMoveLeft || isPending}
        onClick={() => startTransition(() => moveCardAction(cardId, "left"))}
        className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-700"
      >
        ←
      </button>
      <button
        type="button"
        disabled={!canMoveRight || isPending}
        onClick={() => startTransition(() => moveCardAction(cardId, "right"))}
        className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-700"
      >
        →
      </button>
    </div>
  );
}
