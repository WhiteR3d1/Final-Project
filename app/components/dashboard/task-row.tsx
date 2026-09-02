import Link from "next/link";
import { DUE_BUCKET_STYLE, dueBucket, dueLabel, formatDueThai } from "@/lib/due";
import { boardColor } from "@/lib/boards";
import { Chip, Dot } from "@/app/components/ui/chip";
import { IconCheck, IconFlag } from "@/app/components/ui/icons";

export type TaskRowCard = {
  id: string;
  title: string;
  dueDate: Date | null;
  isCompleted: boolean;
  priority: { name: string; color: string } | null;
  list: { name: string; board: { id: string; name: string; color: string | null } };
};

/** แถวงานหนึ่งรายการ ใช้ซ้ำใน "งานที่ต้องส่ง" หน้าค้นหา และปฏิทิน */
export function TaskRow({ card }: { card: TaskRowCard }) {
  const style = card.dueDate && !card.isCompleted ? DUE_BUCKET_STYLE[dueBucket(card.dueDate)] : null;

  return (
    <Link
      href={`/board/${card.list.board.id}`}
      className="border-line bg-panel hover:border-accent/40 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2.5 transition-colors"
    >
      <Dot color={boardColor(card.list.board)} />
      <span
        className={`text-sm font-medium ${card.isCompleted ? "text-muted line-through" : "text-text"}`}
      >
        {card.title}
      </span>

      {card.priority && (
        <Chip color={card.priority.color} title={`ระดับความสำคัญ: ${card.priority.name}`}>
          <IconFlag size={11} />
          {card.priority.name}
        </Chip>
      )}

      <span className="text-muted text-xs">
        {card.list.board.name} · {card.list.name}
      </span>

      <span className="ml-auto flex shrink-0 items-center gap-2">
        {card.isCompleted && (
          <Chip tone="accent">
            <IconCheck size={11} /> เสร็จแล้ว
          </Chip>
        )}
        {card.dueDate && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              style ? style.chip : "bg-panel-2 text-muted"
            }`}
          >
            {formatDueThai(card.dueDate)}
            {!card.isCompleted && ` · ${dueLabel(card.dueDate)}`}
          </span>
        )}
      </span>
    </Link>
  );
}
