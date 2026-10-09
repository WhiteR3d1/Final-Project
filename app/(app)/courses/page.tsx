import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { canTeach } from "@/lib/roles";
import { Panel } from "@/app/components/ui/panel";
import { Chip } from "@/app/components/ui/chip";
import { CreateCourseForm } from "./create-course-form";

/** รายวิชาของอาจารย์คนนี้ — เห็นเฉพาะของตัวเอง (แอดมินก็ไม่เห็นของคนอื่น) */
export default async function CoursesPage() {
  const user = await getCurrentUser();
  if (!canTeach(user.role)) notFound();

  const courses = await prisma.course.findMany({
    where: { teacherId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, joinCode: true, _count: { select: { boards: true } } },
  });

  const pending = await Promise.all(
    courses.map((course) =>
      prisma.card.count({ where: { list: { isReviewList: true, board: { courseId: course.id } } } })
    )
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-text text-xl font-bold tracking-tight">รายวิชาของฉัน</h1>
        <p className="text-muted mt-0.5 text-xs">
          สร้างรายวิชาแล้วบอกรหัสเข้าร่วมกับนักศึกษา — นักศึกษากรอกรหัสใน &ldquo;ตั้งค่าบอร์ด&rdquo;
          เพื่อส่งบอร์ดเข้าวิชา คุณจะเห็นและตรวจได้เฉพาะบอร์ดในวิชาของคุณ
        </p>
      </div>

      <Panel title="สร้างรายวิชาใหม่">
        <CreateCourseForm />
      </Panel>

      {courses.length === 0 ? (
        <Panel>
          <p className="text-muted py-6 text-center text-sm">ยังไม่มีรายวิชา</p>
        </Panel>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map((course, index) => (
            <li key={course.id}>
              <Link
                href={`/courses/${course.id}`}
                className="border-line bg-panel hover:border-accent/50 flex flex-col gap-2 rounded-2xl border p-4 transition-colors"
              >
                <span className="text-text font-semibold">{course.name}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="neutral">รหัส {course.joinCode}</Chip>
                  <Chip tone="neutral">{course._count.boards} บอร์ด</Chip>
                  {pending[index] > 0 && <Chip tone="warn">รอตรวจ {pending[index]}</Chip>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
