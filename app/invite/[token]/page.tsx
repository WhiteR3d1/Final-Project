import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { InviteStatus } from "@/app/generated/prisma/enums";
import { acceptInviteAction } from "./actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  const invite = await prisma.boardInvite.findUnique({
    where: { token },
    include: { board: true },
  });

  if (!invite) notFound();

  const isExpired = invite.expiresAt < new Date();
  const isPending = invite.status === InviteStatus.PENDING;
  const emailMatches = invite.email.toLowerCase() === user.email.toLowerCase();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
      <h1 className="mb-4 text-xl font-semibold">คำเชิญเข้าร่วมบอร์ด</h1>
      <p className="mb-6 text-sm text-zinc-500">
        คุณได้รับเชิญให้เข้าร่วมบอร์ด{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          {invite.board.name}
        </span>
      </p>

      {!isPending && <p className="text-sm text-red-500">คำเชิญนี้ถูกใช้งานไปแล้ว</p>}
      {isPending && isExpired && (
        <p className="text-sm text-red-500">คำเชิญนี้หมดอายุแล้ว</p>
      )}
      {isPending && !isExpired && !emailMatches && (
        <p className="text-sm text-red-500">
          คำเชิญนี้ส่งถึง {invite.email} แต่คุณล็อกอินด้วย {user.email}
        </p>
      )}
      {isPending && !isExpired && emailMatches && (
        <form action={acceptInviteAction}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            ยอมรับคำเชิญ
          </button>
        </form>
      )}

      <Link href="/" className="mt-4 text-sm text-zinc-500 underline">
        กลับหน้าแรก
      </Link>
    </div>
  );
}
