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
      <p className="text-muted mb-6 text-sm">
        คุณได้รับเชิญให้เข้าร่วมบอร์ด{" "}
        <span className="text-text font-medium">
          {invite.board.name}
        </span>
      </p>

      {!isPending && <p className="text-danger text-sm">คำเชิญนี้ถูกใช้งานไปแล้ว</p>}
      {isPending && isExpired && (
        <p className="text-danger text-sm">คำเชิญนี้หมดอายุแล้ว</p>
      )}
      {isPending && !isExpired && !emailMatches && (
        <p className="text-danger text-sm">
          คำเชิญนี้ส่งถึง {invite.email} แต่คุณล็อกอินด้วย {user.email}
        </p>
      )}
      {isPending && !isExpired && emailMatches && (
        <form action={acceptInviteAction}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-sm font-semibold hover:brightness-110"
          >
            ยอมรับคำเชิญ
          </button>
        </form>
      )}

      <Link href="/" className="text-muted mt-4 text-sm underline">
        กลับหน้าแรก
      </Link>
    </div>
  );
}
