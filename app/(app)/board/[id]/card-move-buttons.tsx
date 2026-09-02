"use client";

import { useTransition } from "react";
import { moveCardAction } from "./actions";

export function CardMoveButtons({
  cardId,
  canMoveLeft,
  canMoveRight,
  onAwarded,
}: {
  cardId: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onAwarded?: (points: number) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function move(direction: "left" | "right") {
    startTransition(async () => {
      const result = await moveCardAction(cardId, direction);
      if (result?.awarded) onAwarded?.(result.awarded);
    });
  }

  return (
    <div className="mt-2 flex gap-1">
      <button
        type="button"
        disabled={!canMoveLeft || isPending}
        onClick={() => move("left")}
        className="border-line text-muted hover:bg-panel-2 hover:text-text rounded-lg border px-2 py-1 text-xs disabled:opacity-30"
      >
        ←
      </button>
      <button
        type="button"
        disabled={!canMoveRight || isPending}
        onClick={() => move("right")}
        className="border-line text-muted hover:bg-panel-2 hover:text-text rounded-lg border px-2 py-1 text-xs disabled:opacity-30"
      >
        →
      </button>
    </div>
  );
}
