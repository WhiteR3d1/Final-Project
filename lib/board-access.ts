import "server-only";
import { prisma } from "./prisma";

export type BoardRoleName = "OWNER" | "EDITOR" | "VIEWER";

export type BoardAccess = {
  id: string;
  ownerId: string;
  role: BoardRoleName;
  isOwner: boolean;
  /** OWNER หรือ EDITOR เท่านั้น — VIEWER อ่านได้อย่างเดียว */
  canEdit: boolean;
};

/**
 * ประตูเดียวสู่สิทธิ์ในบอร์ด — คืน null ถ้าไม่ใช่ทั้งเจ้าของและสมาชิก
 *
 * คืน capability มาให้เลย ไม่ให้แต่ละ action ไปตีความ role เอง
 * **action ที่แก้ข้อมูลต้องเช็ค `access.canEdit` ไม่ใช่แค่ว่า `access` ไม่เป็น null**
 */
export async function assertBoardAccess(
  boardId: string,
  userId: string
): Promise<BoardAccess | null> {
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: {
      id: true,
      ownerId: true,
      // owner ไม่มีแถวใน BoardMember จึงอาจได้ array ว่างแม้จะเข้าถึงบอร์ดได้
      members: { where: { userId }, select: { role: true } },
    },
  });

  if (!board) return null;

  const isOwner = board.ownerId === userId;
  const role: BoardRoleName = isOwner ? "OWNER" : (board.members[0]?.role ?? "VIEWER");

  return {
    id: board.id,
    ownerId: board.ownerId,
    role,
    isOwner,
    canEdit: role !== "VIEWER",
  };
}
