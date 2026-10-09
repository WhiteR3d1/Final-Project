import "server-only";
import { prisma } from "./prisma";
import { canTeach, type UserRoleName } from "./roles";

export type BoardRoleName = "OWNER" | "EDITOR" | "VIEWER" | "TEACHER";

export type BoardAccess = {
  id: string;
  ownerId: string;
  /** TEACHER = อาจารย์ของรายวิชาที่บอร์ดนี้ผูกอยู่ (ไม่ได้เป็นเจ้าของ/สมาชิก) เข้ามาดูและตรวจงาน */
  role: BoardRoleName;
  isOwner: boolean;
  /** OWNER หรือ EDITOR เท่านั้น — VIEWER กับ TEACHER อ่านได้อย่างเดียว */
  canEdit: boolean;
  /** อาจารย์เจ้าของรายวิชาของบอร์ดนี้ — ให้คะแนนและอนุมัติการ์ดเข้าคอลัมน์เสร็จสิ้นได้ */
  canReview: boolean;
  /** null = บอร์ดส่วนตัว ไม่มีอาจารย์คนไหนเห็น */
  courseId: string | null;
  /**
   * การ์ดเข้าคอลัมน์เสร็จสิ้นได้ต่อเมื่ออาจารย์อนุมัติ — ต้องมีคอลัมน์ตรวจ **และ** ผูกรายวิชา
   * บอร์ดที่ไม่ผูกวิชาไม่มีใครอนุมัติได้ ถ้าบังคับด่านนี้การ์ดจะค้างตลอดไป
   */
  requiresApproval: boolean;
};

/**
 * ประตูเดียวสู่สิทธิ์ในบอร์ด — คืน null ถ้าไม่ใช่เจ้าของ สมาชิก หรืออาจารย์ของรายวิชาที่บอร์ดผูกอยู่
 *
 * คืน capability มาให้เลย ไม่ให้แต่ละ action ไปตีความ role เอง
 * **action ที่แก้ข้อมูลต้องเช็ค `access.canEdit` ไม่ใช่แค่ว่า `access` ไม่เป็น null**
 * (อาจารย์ผ่านด่าน null ได้ในบอร์ดของวิชาตัวเอง แต่ canEdit เป็น false)
 *
 * `user.role` ต้องมาจาก getCurrentUser() ซึ่งคำนวณ role จริงแล้ว (รวม ADMIN_EMAILS)
 */
export async function assertBoardAccess(
  boardId: string,
  user: { id: string; role: UserRoleName }
): Promise<BoardAccess | null> {
  const teaches = canTeach(user.role);

  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
        // อาจารย์เห็นเฉพาะบอร์ดในวิชาที่ตัวเองสอน ไม่ใช่ทุกบอร์ดในระบบ
        ...(teaches ? [{ course: { teacherId: user.id } }] : []),
      ],
    },
    select: {
      id: true,
      ownerId: true,
      courseId: true,
      course: { select: { teacherId: true } },
      // owner ไม่มีแถวใน BoardMember จึงอาจได้ array ว่างแม้จะเข้าถึงบอร์ดได้
      members: { where: { userId: user.id }, select: { role: true } },
      lists: { where: { isReviewList: true }, select: { id: true }, take: 1 },
    },
  });

  if (!board) return null;

  const isOwner = board.ownerId === user.id;
  const isCourseTeacher = teaches && board.course?.teacherId === user.id;
  // อาจารย์ที่เป็นสมาชิกอยู่แล้วใช้ role เดิม (ยังแก้ได้ถ้าเป็น EDITOR) แค่ได้สิทธิ์ตรวจเพิ่ม
  const role: BoardRoleName = isOwner
    ? "OWNER"
    : (board.members[0]?.role ?? (isCourseTeacher ? "TEACHER" : "VIEWER"));

  return {
    id: board.id,
    ownerId: board.ownerId,
    role,
    isOwner,
    canEdit: role === "OWNER" || role === "EDITOR",
    canReview: isCourseTeacher,
    courseId: board.courseId,
    requiresApproval: board.courseId !== null && board.lists.length > 0,
  };
}
