"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { ActivityType, InviteStatus } from "@/app/generated/prisma/enums";

export async function acceptInviteAction(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string") return;

  const user = await getCurrentUser();

  const invite = await prisma.boardInvite.findUnique({ where: { token } });
  if (!invite) return;
  if (invite.status !== InviteStatus.PENDING) return;
  if (invite.expiresAt < new Date()) return;
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) return;

  await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId: invite.boardId, userId: user.id } },
    update: {},
    create: { boardId: invite.boardId, userId: user.id, role: invite.role },
  });

  await prisma.boardInvite.update({
    where: { id: invite.id },
    data: { status: InviteStatus.ACCEPTED },
  });

  await prisma.activity.create({
    data: {
      boardId: invite.boardId,
      userId: user.id,
      type: ActivityType.MEMBER_JOINED,
      message: `${user.name ?? user.email} joined the board`,
    },
  });

  revalidatePath(`/board/${invite.boardId}`);
  redirect(`/board/${invite.boardId}`);
}

/**
 * เข้าบอร์ดผ่าน "ลิงก์ทั่วไป" — ใครที่ล็อกอินแล้วและมีลิงก์ก็เข้าได้ ไม่ต้องถูกเชิญรายอีเมล
 * ด่านจริงคือ enabled ของลิงก์ ไม่ใช่การเดา token ไม่ออก
 */
export async function joinViaShareLinkAction(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string") return;

  const user = await getCurrentUser();

  const link = await prisma.boardShareLink.findUnique({
    where: { token },
    include: { board: { select: { ownerId: true } } },
  });
  if (!link) return;
  if (!link.enabled) return;

  // เจ้าของไม่มีแถวใน BoardMember ตามดีไซน์ เผลอเพิ่มเมื่อไหร่กฎข้อนั้นก็เสีย
  if (link.board.ownerId !== user.id) {
    const existing = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId: link.boardId, userId: user.id } },
    });

    // update: {} = คนที่เป็นสมาชิกอยู่แล้วต้องไม่ถูกลดสิทธิ์เพราะกดลิงก์ที่ให้สิทธิ์ต่ำกว่า
    await prisma.boardMember.upsert({
      where: { boardId_userId: { boardId: link.boardId, userId: user.id } },
      update: {},
      create: { boardId: link.boardId, userId: user.id, role: link.role },
    });

    if (!existing) {
      await prisma.activity.create({
        data: {
          boardId: link.boardId,
          userId: user.id,
          type: ActivityType.MEMBER_JOINED,
          message: `${user.name ?? user.email} joined the board via share link`,
        },
      });
    }
  }

  revalidatePath(`/board/${link.boardId}`);
  redirect(`/board/${link.boardId}`);
}
