import "server-only";
import { prisma } from "./prisma";
import { isTeacherEmail } from "./teacher";

export type BoardRoleName = "OWNER" | "EDITOR" | "VIEWER" | "TEACHER";

export type BoardAccess = {
  id: string;
  ownerId: string;
  /** TEACHER = อาจารย์ที่ไม่ได้เป็นเจ้าของ/สมาชิก แค่เข้ามาดูและตรวจงาน */
  role: BoardRoleName;
  isOwner: boolean;
  /** OWNER หรือ EDITOR เท่านั้น — VIEWER กับ TEACHER อ่านได้อย่างเดียว */
  canEdit: boolean;
  /** อาจารย์ (`TEACHER_EMAILS`) — ให้คะแนนและอนุมัติการ์ดเข้าคอลัมน์เสร็จสิ้นได้ */
  canReview: boolean;
};

/**
 * ประตูเดียวสู่สิทธิ์ในบอร์ด — คืน null ถ้าไม่ใช่ทั้งเจ้าของ สมาชิก และอาจารย์
 *
 * คืน capability มาให้เลย ไม่ให้แต่ละ action ไปตีความ role เอง
 * **action ที่แก้ข้อมูลต้องเช็ค `access.canEdit` ไม่ใช่แค่ว่า `access` ไม่เป็น null**
 * (อาจารย์ผ่านด่าน null ได้ทุกบอร์ด แต่ canEdit เป็น false)
 */
export async function assertBoardAccess(
  boardId: string,
  user: { id: string; email: string }
): Promise<BoardAccess | null> {
  const isTeacher = isTeacherEmail(user.email);

  const board = await prisma.board.findFirst({
    where: isTeacher
      ? { id: boardId }
      : { id: boardId, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    select: {
      id: true,
      ownerId: true,
      // owner ไม่มีแถวใน BoardMember จึงอาจได้ array ว่างแม้จะเข้าถึงบอร์ดได้
      members: { where: { userId: user.id }, select: { role: true } },
    },
  });

  if (!board) return null;

  const isOwner = board.ownerId === user.id;
  // อาจารย์ที่เป็นสมาชิกอยู่แล้วใช้ role เดิม (ยังแก้ได้ถ้าเป็น EDITOR) แค่ได้สิทธิ์ตรวจเพิ่ม
  const role: BoardRoleName = isOwner
    ? "OWNER"
    : (board.members[0]?.role ?? (isTeacher ? "TEACHER" : "VIEWER"));

  return {
    id: board.id,
    ownerId: board.ownerId,
    role,
    isOwner,
    canEdit: role === "OWNER" || role === "EDITOR",
    canReview: isTeacher,
  };
}
