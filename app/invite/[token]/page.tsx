import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { BoardRole, InviteStatus } from "@/app/generated/prisma/enums";
import { acceptInviteAction, joinViaShareLinkAction } from "./actions";

const pageClass = "mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10";
const buttonClass =
  "bg-accent text-accent-ink self-start rounded-lg px-4 py-2 text-sm font-semibold hover:brightness-110";

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

  // คำเชิญรายอีเมลกับลิงก์ทั่วไปใช้ path เดียวกัน ผู้ใช้จะได้ไม่ต้องรู้ว่าตัวเองถือลิงก์แบบไหน
  if (!invite) return <ShareLinkInvite token={token} userId={user.id} />;

  const isExpired = invite.expiresAt < new Date();
  const isPending = invite.status === InviteStatus.PENDING;
  const emailMatches = invite.email.toLowerCase() === user.email.toLowerCase();

  return (
    <div className={pageClass}>
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
          <button type="submit" className={buttonClass}>
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

/** ปลายทางของ "ลิงก์ทั่วไป" — ใครที่มีลิงก์และล็อกอินแล้วก็กดเข้าร่วมได้เลย */
async function ShareLinkInvite({ token, userId }: { token: string; userId: string }) {
  const shareLink = await prisma.boardShareLink.findUnique({
    where: { token },
    include: { board: true },
  });

  if (!shareLink) notFound();

  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId: shareLink.boardId, userId } },
  });
  // เจ้าของไม่มีแถวใน BoardMember จึงต้องเช็ค ownerId แยก
  const alreadyIn = shareLink.board.ownerId === userId || Boolean(membership);

  return (
    <div className={pageClass}>
      <h1 className="mb-4 text-xl font-semibold">เข้าร่วมบอร์ด</h1>
      <p className="text-muted mb-6 text-sm">
        คุณกำลังจะเข้าร่วมบอร์ด{" "}
        <span className="text-text font-medium">{shareLink.board.name}</span>
        {!alreadyIn && (
          <>
            {" "}
            ในสิทธิ์{" "}
            <span className="text-text font-medium">
              {shareLink.role === BoardRole.VIEWER ? "ดูอย่างเดียว" : "แก้ไขได้"}
            </span>
          </>
        )}
      </p>

      {!shareLink.enabled && !alreadyIn && (
        <p className="text-danger text-sm">ลิงก์นี้ถูกปิดอยู่ ขอลิงก์ใหม่จากเจ้าของบอร์ดได้เลย</p>
      )}

      {alreadyIn ? (
        <Link href={`/board/${shareLink.boardId}`} className={buttonClass}>
          ไปที่บอร์ด
        </Link>
      ) : (
        shareLink.enabled && (
          <form action={joinViaShareLinkAction}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={buttonClass}>
              เข้าร่วมบอร์ด
            </button>
          </form>
        )
      )}

      <Link href="/" className="text-muted mt-4 text-sm underline">
        กลับหน้าแรก
      </Link>
    </div>
  );
}
