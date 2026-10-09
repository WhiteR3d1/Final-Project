import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { canTeach } from "@/lib/roles";
import { boardColor } from "@/lib/boards";
import { formatDueThai, isOnTime } from "@/lib/due";
import type { Prisma } from "@/app/generated/prisma/client";
import { Panel } from "@/app/components/ui/panel";
import { Chip } from "@/app/components/ui/chip";
import { AvatarStack, displayName } from "@/app/components/ui/avatar";
import { IconChecklist, IconFile, IconLink } from "@/app/components/ui/icons";
import { CardReviewResult } from "../board/[id]/card-review-result";
import { cardReviewSelect, publicUserSelect } from "../board/[id]/types";
import { ReviewForm } from "./review-form";

const SUBMITTED_AT_FORMAT = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

// select เฉพาะที่ต้องแสดง — หน้านี้ดึงการ์ดข้ามทุกบอร์ดในระบบ ห้ามดึง User ทั้งแถว
const reviewCardSelect = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  submittedAt: true,
  list: {
    select: {
      name: true,
      board: {
        select: { id: true, name: true, color: true, lists: { where: { isDoneList: true }, select: { id: true } } },
      },
    },
  },
  submittedBy: { select: publicUserSelect },
  createdBy: { select: publicUserSelect },
  assignees: { select: { user: { select: publicUserSelect } } },
  checklists: { select: { items: { select: { isCompleted: true } } } },
  attachments: {
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, name: true, url: true },
  },
  review: { select: cardReviewSelect },
} satisfies Prisma.CardSelect;

type ReviewCard = Prisma.CardGetPayload<{ select: typeof reviewCardSelect }>;

/**
 * หน้าตรวจงานของอาจารย์ — การ์ดในคอลัมน์ "กำลังตรวจสอบ" ของบอร์ดในรายวิชาที่ตัวเองสอน
 * อาจารย์ไม่ต้องถูกเชิญเข้าบอร์ด (ดู canReview ใน lib/board-access.ts)
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; course?: string; board?: string }>;
}) {
  const user = await getCurrentUser();
  // ไม่บอกว่ามีหน้านี้อยู่ เหมือนบอร์ดที่ไม่มีสิทธิ์เข้า
  if (!canTeach(user.role)) notFound();

  const { tab: rawTab, course: courseFilter, board: boardFilter } = await searchParams;
  const tab = rawTab === "done" ? "done" : "pending";

  // เฉพาะวิชาที่ตัวเองสอน — ตัวกรองจาก URL เลือกได้แค่ในชุดนี้ จะใส่ id ของวิชาคนอื่นมาก็ไม่มีผล
  const courses = await prisma.course.findMany({
    where: { teacherId: user.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      boards: { orderBy: { name: "asc" }, select: { id: true, name: true, color: true } },
    },
  });
  const activeCourse = courseFilter ? courses.find((course) => course.id === courseFilter) : undefined;
  const boards = activeCourse ? activeCourse.boards : courses.flatMap((course) => course.boards);
  const activeBoard = boardFilter ? boards.find((board) => board.id === boardFilter) : undefined;

  const inScope = {
    course: { teacherId: user.id },
    ...(activeCourse ? { courseId: activeCourse.id } : {}),
    ...(activeBoard ? { id: activeBoard.id } : {}),
  } satisfies Prisma.BoardWhereInput;

  const pendingWhere = { list: { isReviewList: true, board: inScope } } satisfies Prisma.CardWhereInput;
  const doneWhere = {
    review: { isNot: null },
    list: { isReviewList: false, board: inScope },
  } satisfies Prisma.CardWhereInput;

  const [pendingCount, doneCount, cards] = await Promise.all([
    prisma.card.count({ where: pendingWhere }),
    prisma.card.count({ where: doneWhere }),
    prisma.card.findMany({
      where: tab === "pending" ? pendingWhere : doneWhere,
      // รอตรวจ: ส่งก่อนตรวจก่อน / ตรวจแล้ว: ล่าสุดขึ้นก่อน
      orderBy:
        tab === "pending"
          ? [{ submittedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]
          : [{ updatedAt: "desc" }],
      take: 100,
      select: reviewCardSelect,
    }),
  ]);

  const href = (filters: { tab?: string; course?: string; board?: string }) => {
    const params = new URLSearchParams({ tab: filters.tab ?? tab });
    if (filters.course) params.set("course", filters.course);
    if (filters.board) params.set("board", filters.board);
    return `/review?${params}`;
  };
  const chipClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ${
      active ? "bg-panel-2 text-text font-medium" : "text-muted hover:text-text"
    }`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-text text-xl font-bold tracking-tight">ตรวจงาน</h1>
          <p className="text-muted mt-0.5 text-xs">
            การ์ดที่นักศึกษาลากเข้าคอลัมน์ &ldquo;กำลังตรวจสอบ&rdquo; ในรายวิชาของคุณ — อนุมัติแล้วการ์ดจะเข้าคอลัมน์เสร็จสิ้นและนักศึกษาได้แต้ม
          </p>
        </div>

        <nav className="bg-panel-2 ml-auto flex rounded-xl p-1 text-xs">
          {[
            { key: "pending", label: `รอตรวจ (${pendingCount})` },
            { key: "done", label: `ตรวจแล้ว (${doneCount})` },
          ].map((item) => (
            <Link
              key={item.key}
              href={href({ tab: item.key, course: activeCourse?.id, board: activeBoard?.id })}
              aria-current={tab === item.key ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 ${
                tab === item.key ? "bg-panel text-text font-semibold shadow-sm" : "text-muted hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {courses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={href({})} className={chipClass(!activeCourse && !activeBoard)}>
              ทุกวิชา
            </Link>
            {courses.map((course) => (
              <Link key={course.id} href={href({ course: course.id })} className={chipClass(activeCourse?.id === course.id)}>
                {course.name}
              </Link>
            ))}
          </div>
          {boards.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={href({ course: activeCourse?.id, board: board.id })}
                  className={chipClass(activeBoard?.id === board.id)}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: boardColor(board) }} />
                  {board.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {cards.length === 0 ? (
        <Panel>
          <p className="text-muted py-8 text-center text-sm">
            {courses.length === 0 ? (
              <>
                ยังไม่มีรายวิชา —{" "}
                <Link href="/courses" className="text-accent underline">
                  สร้างรายวิชา
                </Link>{" "}
                แล้วบอกรหัสเข้าร่วมกับนักศึกษา
              </>
            ) : boards.length === 0 ? (
              "ยังไม่มีนักศึกษาส่งบอร์ดเข้ารายวิชาของคุณ"
            ) : tab === "pending" ? (
              "ไม่มีงานรอตรวจ 🎉"
            ) : (
              "ยังไม่มีงานที่ตรวจแล้ว"
            )}
          </p>
        </Panel>
      ) : (
        <ul className="flex flex-col gap-4">
          {cards.map((card) => (
            <li key={card.id}>
              <ReviewCardItem card={card} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCardItem({ card }: { card: ReviewCard }) {
  const board = card.list.board;
  const submitter = card.submittedBy ?? card.createdBy;
  const items = card.checklists.flatMap((checklist) => checklist.items);
  const doneItems = items.filter((item) => item.isCompleted).length;
  const onTime =
    card.dueDate && card.submittedAt ? isOnTime(card.dueDate, card.submittedAt) : null;

  return (
    <Panel bodyClassName="grid grid-cols-1 gap-5 md:grid-cols-[1fr_280px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/board/${board.id}`}
            className="text-muted hover:text-text flex items-center gap-1.5 text-xs"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: boardColor(board) }} />
            {board.name}
          </Link>
          <span className="text-muted text-xs">· {card.list.name}</span>
        </div>

        <h2 className="text-text text-base font-semibold break-words">{card.title}</h2>

        <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span>
            ผู้ส่ง <span className="text-text">{displayName(submitter)}</span>
          </span>
          {card.submittedAt && <span>ส่งเมื่อ {SUBMITTED_AT_FORMAT.format(card.submittedAt)}</span>}
          {card.dueDate && <span>กำหนดส่ง {formatDueThai(card.dueDate, true)}</span>}
          {onTime !== null &&
            (onTime ? <Chip tone="accent">ส่งทันกำหนด</Chip> : <Chip tone="danger">ส่งช้า</Chip>)}
          {card.assignees.length > 0 && (
            <span className="flex items-center gap-1.5">
              ผู้รับผิดชอบ
              <AvatarStack users={card.assignees.map((assignee) => assignee.user)} size={20} max={5} />
            </span>
          )}
        </div>

        {card.description && (
          <p className="text-text line-clamp-6 text-sm break-words whitespace-pre-wrap">
            {card.description}
          </p>
        )}

        {items.length > 0 && (
          <p className="text-muted flex items-center gap-1.5 text-xs tabular-nums">
            <IconChecklist size={13} /> เช็กลิสต์ {doneItems}/{items.length}
          </p>
        )}

        {card.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {card.attachments.map((attachment) => (
              <li key={attachment.id}>
                {/* URL ผ่าน sanitizeAttachmentUrl ตั้งแต่ตอนบันทึกแล้ว (รับแค่ http/https) */}
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={attachment.name}
                  className="border-line bg-panel-2 text-muted hover:text-text flex max-w-56 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs"
                >
                  {attachment.type === "IMAGE" ? (
                    // ไม่ใช้ next/image เพราะ attachment แบบลิงก์ชี้ไปโฮสต์ไหนก็ได้
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={attachment.url} alt="" className="h-6 w-6 rounded object-cover" />
                  ) : attachment.type === "LINK" ? (
                    <IconLink size={13} />
                  ) : (
                    <IconFile size={13} />
                  )}
                  <span className="truncate">{attachment.name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {card.review && <CardReviewResult review={card.review} />}
      </div>

      <aside className="border-line md:border-l md:pl-5">
        <ReviewForm
          key={card.review?.updatedAt.toISOString() ?? "new"}
          cardId={card.id}
          defaultScore={card.review?.score ?? null}
          defaultFeedback={card.review?.feedback ?? null}
          canApprove={board.lists.length > 0}
        />
      </aside>
    </Panel>
  );
}
