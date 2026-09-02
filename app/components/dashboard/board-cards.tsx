import Link from "next/link";
import { boardColor, getUserBoards } from "@/lib/boards";
import { Panel } from "@/app/components/ui/panel";
import { ProgressRing } from "@/app/components/ui/progress-ring";
import { Chip } from "@/app/components/ui/chip";
import { IconUsers } from "@/app/components/ui/icons";

/** การ์ดบอร์ดพร้อมวงแหวนความคืบหน้า */
export async function BoardCards({ userId }: { userId: string }) {
  const { all } = await getUserBoards(userId);

  return (
    <Panel title="บอร์ดของฉัน" subtitle={`ทั้งหมด ${all.length} บอร์ด`}>
      {all.length === 0 ? (
        <p className="border-line text-muted rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          ยังไม่มีบอร์ด — สร้างบอร์ดแรกได้จากแถบเมนูด้านซ้าย
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {all.map((board) => (
            <Link
              key={board.id}
              href={`/board/${board.id}`}
              className="border-line bg-panel-2 hover:border-accent/40 flex items-center gap-4 rounded-xl border p-4 transition-colors"
            >
              <ProgressRing
                value={board.progress}
                size={52}
                stroke={5}
                color={boardColor(board)}
              >
                <span className="text-text text-[11px] font-semibold tabular-nums">
                  {board.doneCards}/{board.totalCards}
                </span>
              </ProgressRing>

              <div className="min-w-0 flex-1">
                <div className="text-text truncate font-medium">{board.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {board.isOwner ? (
                    <Chip tone="neutral">เจ้าของ</Chip>
                  ) : (
                    <Chip tone="info">แชร์จาก {board.ownerName}</Chip>
                  )}
                  {board.memberCount > 0 && (
                    <Chip tone="neutral">
                      <IconUsers size={11} /> {board.memberCount}
                    </Chip>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}
