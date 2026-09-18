"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconChevronDown } from "./icons";

/** สไตล์ของแถวในเมนู — ใช้ร่วมกันทุกช่องเลือกจะได้หน้าตาเหมือนกันหมด */
export const menuItemClass =
  "hover:bg-panel-2 hover:text-text flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs";

/**
 * ปุ่ม + เมนู dropdown ที่ใช้ซ้ำได้ — รวม state เปิด/ปิด, คลิกนอกเมนู และ Esc ไว้ที่เดียว
 * children เป็นฟังก์ชันที่รับ close มา เพราะแต่ละช่องตัดสินใจไม่เหมือนกัน:
 * เลือกได้ค่าเดียว (priority) กดแล้วปิด ส่วนเลือกได้หลายค่า (ป้าย/ผู้รับผิดชอบ) เปิดค้างให้กดต่อ
 */
export function SelectMenu({
  trigger,
  menuLabel,
  children,
}: {
  trigger: ReactNode;
  menuLabel: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const menuId = useId();

  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <div
      className="relative"
      // Esc ตอนเมนูเปิด ให้ปิดแค่เมนู — ถ้าไม่กันไว้ <dialog> ที่ครอบอยู่จะปิดทั้งหน้าต่าง
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={menuLabel}
        className="border-line bg-panel-2 hover:border-accent flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs"
      >
        {trigger}
        <IconChevronDown size={14} className="text-muted ml-auto shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />
          <div
            id={menuId}
            role="group"
            aria-label={menuLabel}
            className="border-line bg-panel absolute top-full left-0 z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border p-1 shadow-xl"
          >
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
}

/** ข้อความตอนไม่มีตัวเลือกให้เลือกเลย (บอร์ดยังไม่ได้ตั้ง label / priority ไว้) */
export function MenuEmpty({ children }: { children: ReactNode }) {
  return <p className="text-muted px-2 py-2 text-[11px] leading-4">{children}</p>;
}
