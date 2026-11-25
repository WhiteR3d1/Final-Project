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
import { formatDueThai } from "@/lib/due";
import { canDeleteAssignment, summarizeAssignmentCopies } from "@/lib/assignment-rules";
import {
  deleteAssignmentAction,
  deleteCourseAction,
  publishAssignmentAction,
  regenerateJoinCodeAction,
  unlinkBoardAction,
} from "../actions";
import { CsvDownloadButton } from "./csv-download-button";
import { AssignmentEditorButton } from "./assignment-dialog";
import { SplitterSettingsButton } from "./splitter-settings-dialog";
import { readSplitterSettings } from "@/lib/task-splitter-rules";
import { isSplitterConfigured } from "@/lib/task-splitter";

// Server Action ใช้ timeout ระดับหน้า (docs ของ Next 16: maxDuration) — ปุ่มแตกงานด้วย AI อาจรอ Typhoon หลายวินาที
export const maxDuration = 60;

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
      splitterSettings: true,
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
      assignments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          publishedAt: true,
          items: { orderBy: { position: "asc" }, select: { id: true, content: true } },
          // สำเนาในแต่ละบอร์ด — นับเฉพาะงานย่อยของอาจารย์ ไม่นับเช็กลิสต์ที่นักศึกษาเพิ่มเอง
          cards: {
            select: {
              submittedAt: true,
              completedAt: true,
              list: { select: { isReviewList: true } },
              review: { select: { status: true } },
              checklists: {
                where: { fromAssignment: true },
                select: { items: { where: { assignmentItemId: { not: null } }, select: { isCompleted: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!course) notFound();

  const aiReady = isSplitterConfigured();
  const splitterSettings = readSplitterSettings(course.splitterSettings);

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

      <Panel
        title="งานที่มอบหมาย"
        subtitle="แจกแล้วทุกบอร์ดในวิชาได้การ์ดพร้อมงานย่อย บอร์ดที่ผูกทีหลังได้งานตอนผูก"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SplitterSettingsButton
              courseId={course.id}
              settings={splitterSettings}
              aiReady={aiReady}
              className={ghostButtonClass}
            />
            <AssignmentEditorButton
              courseId={course.id}
              aiReady={aiReady}
              label="+ สร้างงาน"
              className="bg-accent text-accent-ink rounded-lg px-3 py-1.5 text-xs font-semibold hover:brightness-110"
            />
          </div>
        }
      >
        {course.assignments.length === 0 ? (
          <p className="text-muted py-4 text-center text-sm">
            ยังไม่มีงาน — สร้างงานพร้อมงานย่อย แล้วกดแจกให้ทุกบอร์ดในวิชา
          </p>
        ) : (
          <ul className="flex flex-col">
            {course.assignments.map((assignment) => {
              const copies = assignment.cards.map((card) => ({
                inReviewList: card.list.isReviewList,
                reviewStatus: card.review?.status ?? null,
                submittedAt: card.submittedAt,
                completedAt: card.completedAt,
                items: card.checklists.flatMap((checklist) => checklist.items),
              }));
              const summary = summarizeAssignmentCopies(copies);
              const published = assignment.publishedAt !== null;
              const deletable = canDeleteAssignment(assignment, copies);
              const progressText = [
                `ส่งแล้ว ${summary.submitted}/${summary.boards} บอร์ด`,
                `รอตรวจ ${summary.pending}`,
                `อนุมัติ ${summary.approved}`,
                summary.changesRequested > 0 ? `ส่งกลับแก้ ${summary.changesRequested}` : null,
                summary.progress !== null ? `งานย่อยเสร็จเฉลี่ย ${summary.progress}%` : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li
                  key={assignment.id}
                  className="border-line flex flex-wrap items-start gap-3 border-b py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-text text-sm font-medium break-words">{assignment.title}</span>
                      {published ? <Chip tone="accent">แจกแล้ว</Chip> : <Chip tone="neutral">ร่าง</Chip>}
                      {assignment.dueDate && (
                        <span className="text-muted text-xs">ส่ง {formatDueThai(assignment.dueDate, true)}</span>
                      )}
                    </div>
                    <p className="text-muted mt-0.5 text-xs">
                      งานย่อย {assignment.items.length} ข้อ ·{" "}
                      {published ? progressText : "ยังไม่แจก นักศึกษายังไม่เห็น"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {published && summary.submitted > 0 && (
                      <Link
                        href={`/review?course=${course.id}&assignment=${assignment.id}`}
                        className={ghostButtonClass}
                      >
                        ดูงานที่ส่ง
                      </Link>
                    )}
                    <AssignmentEditorButton
                      courseId={course.id}
                      aiReady={aiReady}
                      assignment={{
                        id: assignment.id,
                        title: assignment.title,
                        description: assignment.description ?? "",
                        dueDate: assignment.dueDate ? assignment.dueDate.toISOString().slice(0, 10) : "",
                        published,
                        items: assignment.items,
                      }}
                      label="แก้ไข"
                      className={ghostButtonClass}
                    />
                    {!published && (
                      <form action={publishAssignmentAction}>
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="assignmentId" value={assignment.id} />
                        <ConfirmSubmitButton
                          confirmLabel={
                            course.boards.length > 0
                              ? `แจกให้ ${course.boards.length} บอร์ด — กดอีกครั้ง`
                              : "ยังไม่มีบอร์ด (ผูกทีหลังได้งานเอง) — กดอีกครั้ง"
                          }
                          className="bg-accent text-accent-ink rounded-lg px-3 py-1.5 text-xs font-semibold hover:brightness-110"
                          confirmClassName="bg-warn text-warn-ink rounded-lg px-3 py-1.5 text-xs font-semibold"
                        >
                          แจกงาน
                        </ConfirmSubmitButton>
                      </form>
                    )}
                    {deletable ? (
                      <form action={deleteAssignmentAction}>
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="assignmentId" value={assignment.id} />
                        <ConfirmSubmitButton
                          confirmLabel={
                            published && summary.boards > 0
                              ? `ลบการ์ดจาก ${summary.boards} บอร์ดด้วย — กดอีกครั้ง`
                              : "กดอีกครั้งเพื่อลบ"
                          }
                          className={`${ghostButtonClass} hover:text-danger`}
                          confirmClassName="bg-danger text-danger-ink rounded-lg px-3 py-1.5 text-xs font-medium"
                        >
                          ลบ
                        </ConfirmSubmitButton>
                      </form>
                    ) : (
                      <span
                        className="text-muted text-[11px]"
                        title="มีบอร์ดส่งงานนี้แล้ว ลบแล้วงานและคะแนนของนักศึกษาจะหาย"
                      >
                        ลบไม่ได้ (มีบอร์ดส่งแล้ว)
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
