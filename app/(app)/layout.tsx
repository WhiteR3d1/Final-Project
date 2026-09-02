import { Sidebar } from "@/app/components/app-shell/sidebar";
import { Topbar } from "@/app/components/app-shell/topbar";

/**
 * โครงของหน้าที่ต้องล็อกอิน (route group ไม่เปลี่ยน URL)
 * ประกาศ props เองแทน LayoutProps<"/"> เพราะ typed routes ของ Next 16
 * map layout ด้วย path ซึ่ง path ของกลุ่มนี้ทับกับ root layout
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
