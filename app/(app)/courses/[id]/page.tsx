import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { canTeach } from "@/lib/roles";
import { boardColor } from "@/lib/boards";
import { Panel } from "@/app/components/ui/panel";
import { Chip } from "@/app/components/ui/chip";
import { displayName } from "@/app/components/ui/avatar";
import { ConfirmSubmitButton } from "@/app/components/ui/buttons";
import { publicUserSelect } from "../../board/[id]/types";
import { deleteCourseAction, regenerateJoinCodeAction, unlinkBoardAction } from "../actions";
import { CsvDownloadButton } from "./csv-download-button";

const ghostButtonClass =
  "border-line text-muted hover:text-text hover:bg-panel-2 rounded-lg border px-3 py-1.5 text-xs";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!canTeach(user.role)) notFound();

  // teacherId ในเงื่อนไข = อาจารย์คนอื่น (รวมแอดมิน) เปิดวิชานี้ไม่ได้
  const course = await prisma.course.findFirst({
    where: { id, teacherId: user.id },
    select: {
      id: true,
      name: true,
      joinCode: true,
      boards: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          owner: { select: publicUserSelect },
          _count: { select: { members: true } },
          lists: { select: { isDoneList: true, isReviewList: true, _count: { select: { cards: true } } } },
        },
      },
    },
  });
  if (!course) notFound();

  const totals = course.boards.reduce(
    (sum, board) => {
      for (const list of board.lists) {
        sum.cards += list._count.cards;
        if (list.isReviewList) sum.pending += list._count.cards;
      }
      return sum;
    },
    { cards: 0, pending: 0 }
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/courses" className="text-muted hover:text-text text-xs">
            ← รายวิชาของฉัน
          </Link>
          <h1 className="text-text mt-1 text-xl font-bold tracking-tight">{course.name}</h1>
          <p className="text-muted mt-0.5 text-xs">
            {course.boards.length} บอร์ด · {totals.cards} การ์ด · รอตรวจ {totals.pending}
          </p>
        </div>
        <CsvDownloadButton courseId={course.id} />
      </header>

      <Panel title="รหัสเข้าร่วม" subtitle="นักศึกษากรอกรหัสนี้ใน ตั้งค่าบอร์ด → รายวิชา เพื่อส่งบอร์ดเข้าวิชานี้">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-text bg-panel-2 rounded-xl px-4 py-2 font-mono text-2xl font-bold tracking-[0.3em]">
            {course.joinCode}
          </span>
          <form action={regenerateJoinCodeAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <ConfirmSubmitButton
              confirmLabel="รหัสเดิมจะใช้ไม่ได้ทันที — กดอีกครั้ง"
              className={ghostButtonClass}
              confirmClassName="bg-warn text-warn-ink rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              สุ่มรหัสใหม่
            </ConfirmSubmitButton>
          </form>
        </div>
      </Panel>

      <Panel title="บอร์ดในรายวิชา">
        {course.boards.length === 0 ? (
          <p className="text-muted py-4 text-center text-sm">ยังไม่มีนักศึกษาส่งบอร์ดเข้าวิชานี้</p>
        ) : (
          <ul className="flex flex-col">
            {course.boards.map((board) => {
              const cards = board.lists.reduce((sum, list) => sum + list._count.cards, 0);
              const pending = board.lists
                .filter((list) => list.isReviewList)
                .reduce((sum, list) => sum + list._count.cards, 0);
              const done = board.lists
                .filter((list) => list.isDoneList)
                .reduce((sum, list) => sum + list._count.cards, 0);

              return (
                <li key={board.id} className="border-line flex flex-wrap items-center gap-3 border-b py-3 last:border-b-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: boardColor(board) }} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/board/${board.id}`} className="text-text hover:text-accent text-sm font-medium">
                      {board.name}
                    </Link>
                    <div className="text-muted text-xs">
                      {displayName(board.owner)} · สมาชิก {board._count.members + 1} คน · เสร็จ {done}/{cards}
                    </div>
                  </div>
                  {pending > 0 && (
                    <Link href={`/review?board=${board.id}`}>
                      <Chip tone="warn">รอตรวจ {pending}</Chip>
                    </Link>
                  )}
                  <form action={unlinkBoardAction}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="boardId" value={board.id} />
                    <ConfirmSubmitButton
                      confirmLabel="ถอนออก?"
                      className={ghostButtonClass}
                      confirmClassName="bg-danger/15 text-danger rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      ถอนออกจากวิชา
                    </ConfirmSubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <section className="border-danger/30 flex flex-wrap items-center gap-3 rounded-2xl border p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-danger text-sm font-semibold">ลบรายวิชา</h2>
          <p className="text-muted text-xs">
            บอร์ดในวิชาจะกลับเป็นบอร์ดส่วนตัวของนักศึกษา ผลตรวจบนการ์ดยังอยู่ แต่คุณจะดูบอร์ดเหล่านั้นไม่ได้อีก
          </p>
        </div>
        <form action={deleteCourseAction}>
          <input type="hidden" name="courseId" value={course.id} />
          <ConfirmSubmitButton
            confirmLabel="กดอีกครั้งเพื่อลบรายวิชา"
            className="border-danger/40 text-danger hover:bg-danger/10 rounded-lg border px-3 py-1.5 text-xs font-medium"
            confirmClassName="bg-danger text-danger-ink rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            ลบรายวิชานี้
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
