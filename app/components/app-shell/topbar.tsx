import { getCurrentUser } from "@/lib/dal";
import { Avatar } from "@/app/components/ui/avatar";
import { IconSearch } from "@/app/components/ui/icons";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

export async function Topbar() {
  const user = await getCurrentUser();

  return (
    <header className="border-line bg-surface/80 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur md:px-8">
      <MobileNav>
        <Sidebar variant="drawer" />
      </MobileNav>

      {/* ค้นหาเป็นฟอร์ม GET ธรรมดา — นำทางไป /search โดยไม่ต้องมี JS ฝั่ง client */}
      <form action="/search" className="relative max-w-xl flex-1">
        <span className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
          <IconSearch size={16} />
        </span>
        <input
          type="search"
          name="q"
          placeholder="ค้นหางานจากทุกบอร์ด"
          aria-label="ค้นหางาน"
          className="border-line bg-panel text-text placeholder:text-muted focus:border-accent w-full rounded-xl border py-2 pr-3 pl-9 text-sm focus:outline-none"
        />
      </form>

      <Avatar user={user} size={32} />
    </header>
  );
}
