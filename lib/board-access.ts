import "server-only";
import { prisma } from "./prisma";

/**
 * Returns the board's id + ownerId only if userId is the owner or a member.
 * Used to gate board reads/mutations now that real sessions exist.
 */
export async function assertBoardAccess(boardId: string, userId: string) {
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true, ownerId: true },
  });

  return board;
}
