"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Chip } from "@/app/components/ui/chip";
import { CardReviewResult } from "../board/[id]/card-review-result";
import type { PublicUser } from "../board/[id]/types";
import { markReviewsSeenAction } from "./actions";

export type MyReviewItem = {
  id: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
  score: number | null;
  feedback: string | null;
  updatedAt: Date;
  reviewer: PublicUser;
  card: { title: string; board: { id: string; name: string } };
};

/**
 * จำชุด "ใหม่" ไว้ตั้งแต่ render แรก — พอ mark ว่าอ่านแล้ว หน้าจะ revalidate และ server
 * จะไม่มองว่าอันไหนใหม่อีก ถ้าไม่ล็อกไว้ ป้าย "ใหม่" จะหายไปก่อนผู้ใช้ทันได้เห็น
 */
export function ReviewList({
  items,
  unreadIds,
  renderedAt,
}: {
  items: MyReviewItem[];
  unreadIds: string[];
  renderedAt: string;
}) {
  const [freshIds] = useState(() => new Set(unreadIds));

  useEffect(() => {
    if (freshIds.size > 0) void markReviewsSeenAction(renderedAt);
  }, [freshIds, renderedAt]);

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/board/${item.card.board.id}`} className="text-text hover:text-accent text-sm font-medium">
              {item.card.title}
            </Link>
            <span className="text-muted text-xs">· {item.card.board.name}</span>
            {freshIds.has(item.id) && <Chip tone="accent">ใหม่</Chip>}
          </div>
          <CardReviewResult review={item} />
        </li>
      ))}
    </ul>
  );
}
