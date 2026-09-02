"use client";

import { useState, type ReactNode } from "react";
import { IconClose, IconMenu } from "@/app/components/ui/icons";

/** ปุ่มแฮมเบอร์เกอร์ + drawer สำหรับจอเล็ก — เนื้อในคือ <Sidebar> ที่ส่งมาเป็น children */
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="เปิดเมนู"
        className="text-muted hover:bg-panel-2 hover:text-text rounded-lg p-2 md:hidden"
      >
        <IconMenu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* คลิกลิงก์ข้างในแล้วให้ drawer ปิดเอง (ไม่ต้องพึ่ง effect ตาม pathname) */}
          <div className="relative h-full" onClick={() => setOpen(false)}>
            {children}
            <button
              type="button"
              aria-label="ปิดเมนู"
              className="text-muted hover:text-text absolute top-4 right-2 rounded-lg p-1.5"
            >
              <IconClose size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
