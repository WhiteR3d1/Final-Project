"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { createBoardAction } from "@/app/actions/board";
import { Modal } from "@/app/components/ui/modal";
import { ColorPicker, PRESET_COLORS } from "@/app/components/ui/color-picker";
import { SubmitButton } from "@/app/components/ui/buttons";
import { IconPlus } from "@/app/components/ui/icons";

const fieldClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";
const labelClass = "text-muted mb-1.5 block text-xs font-medium";

/** ปุ่ม + หน้าต่างสร้างบอร์ด — แยกเป็น client component เพราะ Sidebar เป็น server component */
export function CreateBoardDialog() {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const pathname = usePathname();
  const [pathAtRender, setPathAtRender] = useState(pathname);

  // createBoardAction จบด้วย redirect() ซึ่งโยน NEXT_REDIRECT ออกมา โค้ดหลัง await จึงไม่ทำงาน
  // และ Sidebar อยู่ใน layout เลยไม่ถูก unmount ตอนเปลี่ยนหน้า — ปิดเองเมื่อ path เปลี่ยนแทน
  // (เซ็ต state ระหว่าง render ตามแพตเทิร์นเดียวกับ kanban-board.tsx ไม่ใช้ useEffect sync)
  if (pathname !== pathAtRender) {
    setPathAtRender(pathname);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        // drawer บนมือถือปิดตัวเองเมื่อคลิกอะไรก็ตามข้างใน ถ้าปล่อยให้ลอยขึ้นไป
        // React tree จะถูก unmount แล้ว modal กะพริบหายทันทีที่เปิด
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className="border-line text-muted hover:text-text hover:border-accent mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs"
      >
        <IconPlus size={14} /> สร้างบอร์ดใหม่
      </button>

      {open && (
        <Modal open onClose={() => setOpen(false)} size="sm" title="สร้างบอร์ดใหม่">
          <form action={createBoardAction} className="flex flex-col gap-4">
            <div>
              <label className={labelClass} htmlFor="board-name">
                ชื่อบอร์ด
              </label>
              <input
                id="board-name"
                type="text"
                name="name"
                placeholder="เช่น โปรเจกต์จบ"
                required
                autoFocus
                autoComplete="off"
                maxLength={80}
                className={fieldClass}
              />
            </div>

            <div>
              <span className={labelClass}>สี</span>
              <ColorPicker name="color" value={color} onChange={setColor} />
            </div>

            <div>
              <label className={labelClass} htmlFor="board-description">
                คำอธิบาย
              </label>
              <textarea
                id="board-description"
                name="description"
                placeholder="บอร์ดนี้ใช้ทำอะไร..."
                rows={3}
                maxLength={300}
                className={`${fieldClass} resize-y`}
              />
            </div>

            <div className="border-line flex items-center justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border-line text-muted hover:text-text hover:bg-panel-2 rounded-lg border px-3 py-1.5 text-sm"
              >
                ยกเลิก
              </button>
              <SubmitButton
                pendingLabel="กำลังสร้าง..."
                className="bg-accent text-accent-ink rounded-lg px-4 py-1.5 text-sm font-medium hover:brightness-110"
              >
                สร้างบอร์ด
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
