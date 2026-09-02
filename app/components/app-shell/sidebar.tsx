import { getCurrentUser } from "@/lib/dal";
import { boardColor, getUserBoards } from "@/lib/boards";
import { logout } from "@/app/actions/auth";
import { Avatar, displayName } from "@/app/components/ui/avatar";
import { IconCalendar, IconHome, IconLogout } from "@/app/components/ui/icons";
import { SubmitButton } from "@/app/components/ui/buttons";
import { CreateBoardDialog } from "./create-board-dialog";
import { BoardNavLink, NavLink } from "./nav-link";

/**
 * แถบนำทางหลัก — ดึงข้อมูลเอง (server component)
 * getUserBoards ห่อด้วย cache() อยู่แล้ว จึงเรียกซ้ำในหน้าเดียวกันได้โดยไม่ query ซ้ำ
 */
export async function Sidebar({ variant = "fixed" }: { variant?: "fixed" | "drawer" }) {
  const user = await getCurrentUser();
  const { owned, shared } = await getUserBoards(user.id);

  return (
    <aside
      className={`border-line bg-panel flex w-64 shrink-0 flex-col gap-5 border-r px-3 py-4 ${
        // sticky + h-screen ไม่งั้น aside จะยืดตามความสูงของ "หน้า"
        // แถวผู้ใช้/ปุ่มออกจากระบบเลยตกไปอยู่ท้ายหน้าจนมองไม่เห็นเวลาเนื้อหายาว
        variant === "fixed" ? "sticky top-0 hidden h-screen md:flex" : "h-full"
      }`}
    >
      <div className="flex items-center gap-2 px-2">
        <span className="bg-accent text-accent-ink flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">
          K
        </span>
        <span className="text-text text-base font-semibold tracking-tight">Kanban+</span>
      </div>

      <nav className="flex flex-col gap-1">
        <p className="text-muted px-3 pb-1 text-[11px] font-medium">เมนู</p>
        <NavLink href="/" icon={<IconHome size={18} />} exact>
          หน้าแรก
        </NavLink>
        <NavLink href="/calendar" icon={<IconCalendar size={18} />}>
          ปฏิทินงาน
        </NavLink>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <p className="text-muted px-3 pb-1 text-[11px] font-medium">บอร์ดของฉัน</p>
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {owned.map((board) => (
            <BoardNavLink
              key={board.id}
              href={`/board/${board.id}`}
              color={boardColor(board)}
            >
              {board.name}
            </BoardNavLink>
          ))}
          {owned.length === 0 && (
            <p className="text-muted px-3 py-1 text-xs">ยังไม่มีบอร์ด</p>
          )}

          {shared.length > 0 && (
            <>
              <p className="text-muted px-3 pt-3 pb-1 text-[11px] font-medium">แชร์กับฉัน</p>
              {shared.map((board) => (
                <BoardNavLink
                  key={board.id}
                  href={`/board/${board.id}`}
                  color={boardColor(board)}
                >
                  {board.name}
                </BoardNavLink>
              ))}
            </>
          )}
        </div>

        <div className="px-1">
          <CreateBoardDialog />
        </div>
      </div>

      <div className="border-line flex items-center gap-2 border-t px-2 pt-3">
        <Avatar user={user} size={28} />
        <span className="text-text min-w-0 flex-1 truncate text-xs">{displayName(user)}</span>
        <form action={logout}>
          <SubmitButton
            ariaLabel="ออกจากระบบ"
            title="ออกจากระบบ"
            className="text-muted hover:bg-panel-2 hover:text-danger rounded-lg p-1.5"
          >
            <IconLogout size={16} />
          </SubmitButton>
        </form>
      </div>
    </aside>
  );
}
