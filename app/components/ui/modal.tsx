"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "./icons";

const SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
} as const;

/**
 * ครอบ <dialog> ของเบราว์เซอร์ตรง ๆ — ได้ปิดด้วย Esc, focus trap และ backdrop มาให้ฟรี
 * โดยไม่ต้องเพิ่มไลบรารี
 */
export function Modal({
  open,
  onClose,
  title,
  size = "md",
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  busy?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={() => { if (!busy) onClose(); }}
      onCancel={(event) => { if (busy) event.preventDefault(); }}
      // คลิกนอกกล่อง (โดน backdrop ซึ่งนับเป็นตัว dialog เอง) = ปิด
      onClick={(event) => {
        if (!busy && event.target === dialogRef.current) onClose();
      }}
      className={`border-line bg-panel text-text m-auto w-[92vw] rounded-2xl border p-0 shadow-2xl backdrop:bg-black/60 ${SIZE_CLASS[size]}`}
    >
      <header className="border-line bg-panel sticky top-0 flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="text-text text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="ปิดหน้าต่าง"
          className="text-muted hover:bg-panel-2 hover:text-text rounded-lg p-1.5"
        >
          <IconClose size={18} />
        </button>
      </header>
      <div className="max-h-[72vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}
