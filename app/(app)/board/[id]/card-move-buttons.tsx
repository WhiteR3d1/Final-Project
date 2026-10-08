"use client";

import { useTransition } from "react";
import { moveCardAction } from "./actions";

export function CardMoveButtons({
  cardId,
  canMoveLeft,
  canMoveRight,
  moveRightBlocked = false,
  onAwarded,
  onError,
}: {
  cardId: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  /** คอลัมน์ทางขวาคือคอลัมน์เสร็จสิ้นของบอร์ดที่ต้องให้อาจารย์ตรวจก่อน */
  moveRightBlocked?: boolean;
  onAwarded?: (points: number) => void;
  onError?: (message: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function move(direction: "left" | "right") {
    startTransition(async () => {
      const result = await moveCardAction(cardId, direction);
      if (result && "error" in result) {
        onError?.(result.error);
        return;
      }
      if (result?.awarded) onAwarded?.(result.awarded);
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex gap-1">
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
          disabled={!canMoveRight || moveRightBlocked || isPending}
          onClick={() => move("right")}
          className="border-line text-muted hover:bg-panel-2 hover:text-text rounded-lg border px-2 py-1 text-xs disabled:opacity-30"
        >
          →
        </button>
      </div>
      {moveRightBlocked && (
        <p className="text-muted text-[11px] leading-4">
          รอให้อาจารย์ตรวจและอนุมัติ การ์ดจะเข้าคอลัมน์เสร็จสิ้นเอง
        </p>
      )}
    </div>
  );
}
