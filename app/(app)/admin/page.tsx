import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { canManageUsers, effectiveRole, isAdminEmail, ROLE_LABEL } from "@/lib/roles";
import { Panel } from "@/app/components/ui/panel";
import { UserRow, type AdminUserRow } from "./user-row";

/** หน้าจัดการผู้ใช้ของแอดมิน — role / ระงับบัญชี / ตั้งรหัสใหม่ (ไม่เห็นบอร์ดหรือรายวิชาของใคร) */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const me = await getCurrentUser();
  // ไม่บอกว่ามีหน้านี้อยู่ เหมือนบอร์ดที่ไม่มีสิทธิ์เข้า
  if (!canManageUsers(me.role)) notFound();

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  // select เองทุกฟิลด์ — หน้านี้ส่งรายชื่อทุกคนเข้า client component ห้ามมี passwordHash หลุดไป
  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      disabledAt: true,
      _count: { select: { coursesTaught: true } },
    },
  });

  const rows: AdminUserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: effectiveRole(user),
    disabled: Boolean(user.disabledAt),
    courseCount: user._count.coursesTaught,
    lockedReason:
      user.id === me.id ? "บัญชีของคุณ" : isAdminEmail(user.email) ? "แอดมินจาก ADMIN_EMAILS" : null,
  }));

  const counts = rows.reduce(
    (total, row) => ({ ...total, [row.role]: (total[row.role] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-text text-xl font-bold tracking-tight">จัดการผู้ใช้</h1>
          <p className="text-muted mt-0.5 text-xs">
            {Object.entries(ROLE_LABEL)
              .map(([role, label]) => `${label} ${counts[role] ?? 0}`)
              .join(" · ")}
            {users.length === 200 && " (แสดง 200 คนแรก ใช้ช่องค้นหาเพื่อหาคนที่เหลือ)"}
          </p>
        </div>
        <form className="ml-auto" action="/admin">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="ค้นหาชื่อหรืออีเมล"
            aria-label="ค้นหาผู้ใช้"
            className="border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-56 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
          />
        </form>
      </header>

      <Panel>
        {rows.length === 0 ? (
          <p className="text-muted py-8 text-center text-sm">ไม่พบผู้ใช้ที่ตรงกับ &ldquo;{query}&rdquo;</p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <UserRow key={`${row.id}-${row.role}-${row.disabled}`} user={row} />
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-muted text-xs leading-5">
        การตั้งรหัสใหม่ไม่ได้ทำให้ผู้ใช้ที่ล็อกอินค้างอยู่หลุดออกจากระบบ ถ้าต้องการตัดการใช้งานทันทีให้ระงับบัญชี
        แอดมินจาก <code>ADMIN_EMAILS</code> แก้จากหน้านี้ไม่ได้ ต้องแก้ใน env
      </p>
    </div>
  );
}
