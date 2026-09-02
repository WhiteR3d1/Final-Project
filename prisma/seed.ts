import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { ActivityType } from "../app/generated/prisma/enums";

const DEMO_PASSWORD = "demopass123";

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

  const board = await prisma.board.upsert({
    where: { id: "seed-board-1" },
    update: {},
    create: {
      id: "seed-board-1",
      name: "Study Plan",
      description: "บอร์ดตัวอย่างสำหรับทดสอบระบบ",
      ownerId: user.id,
    },
  });

  const listSeeds = [
    { id: "seed-list-todo", name: "To Do", position: 1, isDoneList: false },
    { id: "seed-list-doing", name: "Doing", position: 2, isDoneList: false },
    { id: "seed-list-done", name: "Done", position: 3, isDoneList: true },
  ];

  const [todo, doing, done] = await Promise.all(
    listSeeds.map((list) =>
      prisma.list.upsert({
        where: { id: list.id },
        update: { isDoneList: list.isDoneList },
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

  console.log("Seeded:", { user: user.email, board: board.name, lists: [todo.name, doing.name, done.name], cards: cards.map((c) => c.title) });
  console.log(`Login with: ${user.email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
