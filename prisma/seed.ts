import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { ActivityType, UserRole } from "../app/generated/prisma/enums";

const DEMO_PASSWORD = "demopass123";
// บัญชีตัวอย่าง — รหัสพวกนี้อยู่ใน repo สาธารณะ ห้ามใช้กับระบบที่เปิดให้คนอื่นใช้จริง
const TEACHER_EMAIL = "teacher@kanban.dev";
const TEACHER_PASSWORD = "teacherpass123";
// เป็นแอดมินก็ต่อเมื่ออีเมลนี้อยู่ใน ADMIN_EMAILS ของ .env (seed สร้างบัญชีไว้ก่อน กันคนอื่นสมัครอีเมลนี้ไปก่อน)
const ADMIN_EMAIL = "admin@kanban.dev";
const ADMIN_PASSWORD = "adminpass123";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@kanban.dev" },
    update: { passwordHash },
    create: {
      email: "demo@kanban.dev",
      name: "Demo User",
      passwordHash,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: TEACHER_EMAIL },
    update: { passwordHash: await bcrypt.hash(TEACHER_PASSWORD, 10), role: UserRole.TEACHER },
    create: {
      email: TEACHER_EMAIL,
      name: "อาจารย์ตัวอย่าง",
      role: UserRole.TEACHER,
      passwordHash: await bcrypt.hash(TEACHER_PASSWORD, 10),
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10) },
    create: {
      email: ADMIN_EMAIL,
      name: "ผู้ดูแลระบบ",
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
    },
  });

  // รายวิชาตัวอย่างของอาจารย์ — รหัสตายตัวให้ทดสอบซ้ำได้ (ใช้แค่ตัวอักษรที่ generateJoinCode ใช้)
  const course = await prisma.course.upsert({
    where: { id: "seed-course-1" },
    update: { teacherId: teacher.id },
    create: { id: "seed-course-1", name: "วิชาตัวอย่าง", joinCode: "KANBAN", teacherId: teacher.id },
  });

  const board = await prisma.board.upsert({
    where: { id: "seed-board-1" },
    // update ต้องมี courseId ด้วย ไม่งั้นบอร์ดที่ seed ไว้ก่อนมีรายวิชาจะไม่ถูกผูก
    update: { courseId: course.id },
    create: {
      id: "seed-board-1",
      name: "Study Plan",
      description: "บอร์ดตัวอย่างสำหรับทดสอบระบบ",
      ownerId: user.id,
      courseId: course.id,
    },
  });

  // คอลัมน์ตรวจอยู่ก่อนคอลัมน์เสร็จสิ้น ซึ่งต้องอยู่ขวาสุดเสมอ
  const listSeeds = [
    { id: "seed-list-todo", name: "To Do", position: 1, isDoneList: false, isReviewList: false },
    { id: "seed-list-doing", name: "Doing", position: 2, isDoneList: false, isReviewList: false },
    { id: "seed-list-review", name: "กำลังตรวจสอบ", position: 2.5, isDoneList: false, isReviewList: true },
    { id: "seed-list-done", name: "Done", position: 3, isDoneList: true, isReviewList: false },
  ];

  const [todo, doing, review, done] = await Promise.all(
    listSeeds.map((list) =>
      prisma.list.upsert({
        where: { id: list.id },
        update: { isDoneList: list.isDoneList, isReviewList: list.isReviewList },
        create: { ...list, boardId: board.id },
      })
    )
  );

  const daysFromNow = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
  };

  const cards = await Promise.all([
    prisma.card.upsert({
      where: { id: "seed-card-1" },
      update: {},
      create: {
        id: "seed-card-1",
        title: "อ่านเอกสาร Prisma",
        listId: todo.id,
        position: 1,
        dueDate: daysFromNow(3),
        createdById: user.id,
      },
    }),
    prisma.card.upsert({
      where: { id: "seed-card-2" },
      update: {},
      create: {
        id: "seed-card-2",
        title: "ออกแบบหน้า Dashboard",
        listId: doing.id,
        position: 1,
        dueDate: daysFromNow(-2),
        createdById: user.id,
      },
    }),
    prisma.card.upsert({
      where: { id: "seed-card-4" },
      update: {},
      create: {
        id: "seed-card-4",
        title: "ส่งรายงานบทที่ 1",
        listId: review.id,
        position: 1,
        dueDate: daysFromNow(1),
        createdById: user.id,
        submittedById: user.id,
        submittedAt: new Date(),
      },
    }),
    prisma.card.upsert({
      where: { id: "seed-card-3" },
      update: {},
      create: {
        id: "seed-card-3",
        title: "ตั้งค่า Neon + Prisma",
        listId: done.id,
        position: 1,
        isCompleted: true,
        dueDate: daysFromNow(0),
        createdById: user.id,
      },
    }),
  ]);

  const existingActivity = await prisma.activity.findFirst({
    where: { boardId: board.id, type: ActivityType.BOARD_CREATED },
  });

  if (!existingActivity) {
    await prisma.activity.create({
      data: {
        boardId: board.id,
        userId: user.id,
        type: ActivityType.BOARD_CREATED,
        message: `${user.name} created board "${board.name}"`,
      },
    });
  }

  console.log("Seeded:", {
    user: user.email,
    board: board.name,
    lists: [todo.name, doing.name, review.name, done.name],
    cards: cards.map((c) => c.title),
  });
  console.log(`Login with: ${user.email} / ${DEMO_PASSWORD}`);
  console.log(`Teacher: ${teacher.email} / ${TEACHER_PASSWORD} — รายวิชา "${course.name}" รหัส ${course.joinCode}`);
  console.log(`Admin: ${admin.email} / ${ADMIN_PASSWORD} (ต้องอยู่ใน ADMIN_EMAILS ของ .env)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
