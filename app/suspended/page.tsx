import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/dal";
import { isAdminEmail } from "@/lib/roles";
import { logout } from "@/app/actions/auth";
import { SubmitButton } from "@/app/components/ui/buttons";

/**
 * ปลายทางของบัญชีที่ถูกระงับระหว่างที่ยังล็อกอินค้างอยู่ (getCurrentUser() พามาที่นี่)
 * อยู่นอก (app) เพราะ layout นั้นเรียก getCurrentUser() ซึ่งจะ redirect กลับมาที่นี่ = วนลูป
 * และหน้านี้ต้องใช้ getSessionUser() ด้วยเหตุผลเดียวกัน
 */
export default async function SuspendedPage() {
  const user = await getSessionUser();
  if (!user.disabledAt || isAdminEmail(user.email)) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-text text-xl font-semibold">บัญชีนี้ถูกระงับ</h1>
      <p className="text-muted text-sm">
        บัญชี <span className="text-text">{user.email}</span> ถูกผู้ดูแลระบบระงับการใช้งาน
        หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบหรืออาจารย์ผู้สอน
      </p>
      <form action={logout}>
        <SubmitButton
          pendingLabel="กำลังออกจากระบบ..."
          className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-sm font-semibold hover:brightness-110"
        >
          ออกจากระบบ
        </SubmitButton>
      </form>
    </div>
  );
}
