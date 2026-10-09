import "server-only";
import { prisma } from "./prisma";
import { accessibleBoardWhere } from "./boards";
import { dateKey } from "./due";
import { levelFromPoints, rankEntries, streakFromDayKeys } from "./points";

export type LeaderboardPeriod = "all" | "week";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** รายวิชาที่ผู้ใช้อยู่ = วิชาของบอร์ดที่เป็นเจ้าของ/สมาชิก + วิชาที่ตัวเองสอน */
export async function getMyCourses(userId: string) {
  return prisma.course.findMany({
    where: { OR: [{ teacherId: userId }, { boards: { some: accessibleBoardWhere(userId) } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, teacherId: true },
  });
}

/**
 * อันดับเพื่อนร่วมรายวิชา — คนในอันดับคือเจ้าของ + สมาชิกของบอร์ดในวิชา (ไม่นับอาจารย์ผู้สอน)
 *
 * **จัดอันดับด้วยแต้มที่ได้จากบอร์ดในวิชานี้เท่านั้น** ไม่ใช่แต้มรวม เพราะบอร์ดในวิชาต้องผ่านอาจารย์อนุมัติ
 * ก่อนได้แต้ม ส่วนบอร์ดส่วนตัวสร้างการ์ดง่าย ๆ ปั๊มแต้มเองได้ ส่วนเลเวลกับสตรีคยังมาจากแต้มรวม
 * ให้ตรงกับแผง "ความคืบหน้าของฉัน"
 *
 * ผู้เรียกต้องส่ง course ที่ได้จาก getMyCourses() เท่านั้น — กันการใส่ courseId ของวิชาอื่นใน URL
 */
export async function getCourseLeaderboard(
  userId: string,
  course: { id: string; teacherId: string },
  period: LeaderboardPeriod
) {
  const boards = await prisma.board.findMany({
    where: { courseId: course.id },
    select: { id: true, ownerId: true, members: { select: { userId: true } } },
  });

  const boardIds = boards.map((board) => board.id);
  const userIds = [
    ...new Set(boards.flatMap((board) => [board.ownerId, ...board.members.map((member) => member.userId)])),
  ].filter((id) => id !== course.teacherId);
  if (userIds.length === 0) return [];

  const now = Date.now();
  const [coursePoints, totalPoints, recentEvents, users] = await Promise.all([
    prisma.pointEvent.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        boardId: { in: boardIds },
        ...(period === "week" ? { createdAt: { gte: new Date(now - 7 * MS_PER_DAY) } } : {}),
      },
      _sum: { points: true },
    }),
    prisma.pointEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _sum: { points: true },
    }),
    // พอสำหรับนับสตรีค (ค่าเดียวกับ getUserGameStats)
    prisma.pointEvent.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: new Date(now - 60 * MS_PER_DAY) } },
      select: { userId: true, createdAt: true },
    }),
    // ฟิลด์ที่ส่งไปหน้าเว็บได้เท่านั้น ห้ามมี passwordHash
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    }),
  ]);

  const sumOf = (rows: typeof coursePoints, id: string) =>
    rows.find((row) => row.userId === id)?._sum.points ?? 0;
  const dayKeys = new Map<string, Set<string>>();
  for (const event of recentEvents) {
    const keys = dayKeys.get(event.userId) ?? new Set<string>();
    keys.add(dateKey(event.createdAt));
    dayKeys.set(event.userId, keys);
  }

  return rankEntries(
    users.map((user) => {
      const total = sumOf(totalPoints, user.id);
      return {
        userId: user.id,
        user,
        name: user.name ?? user.email,
        points: sumOf(coursePoints, user.id),
        level: levelFromPoints(total),
        streak: streakFromDayKeys(dayKeys.get(user.id) ?? new Set()),
      };
    }),
    userId
  );
}
