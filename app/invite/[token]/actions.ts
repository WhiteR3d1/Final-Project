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
