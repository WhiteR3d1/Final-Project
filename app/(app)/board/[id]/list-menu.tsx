"use client";

import { useState } from "react";
import { ConfirmSubmitButton, SubmitButton } from "@/app/components/ui/buttons";
import { IconCheck, IconDots, IconTrash } from "@/app/components/ui/icons";
import { deleteListAction, setDoneListAction } from "./actions";

const itemClass =
  "text-muted hover:bg-panel-2 hover:text-text flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs";

/** เมนู ⋯ ของคอลัมน์ — รวมคำสั่งที่เมื่อก่อนซ่อนอยู่ในปุ่มที่ต้อง hover ถึงจะเห็น */
export function ListMenu({
  listId,
  listName,
  isDoneList,
  onRename,
}: {
  listId: string;
  listName: string;
  isDoneList: boolean;
  onRename: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" data-no-drag>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`ตัวเลือกของคอลัมน์ ${listName}`}
        aria-expanded={open}
        className="text-muted hover:bg-panel-2 hover:text-text rounded-lg p-1"
      >
        <IconDots size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="border-line bg-panel absolute top-8 right-0 z-20 w-56 rounded-xl border p-1 shadow-xl">
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                onRename();
              }}
            >
              เปลี่ยนชื่อคอลัมน์
            </button>

            <form action={setDoneListAction}>
              <input type="hidden" name="listId" value={listId} />
              <SubmitButton className={itemClass}>
                <IconCheck size={14} />
                {isDoneList ? "ยกเลิกคอลัมน์เสร็จสิ้น" : "ตั้งเป็นคอลัมน์เสร็จสิ้น"}
              </SubmitButton>
            </form>

            <form action={deleteListAction}>
              <input type="hidden" name="listId" value={listId} />
              <ConfirmSubmitButton
                className={`${itemClass} hover:text-danger`}
                confirmClassName="bg-danger/15 text-danger flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium"
                confirmLabel="กดอีกครั้งเพื่อลบคอลัมน์"
              >
                <IconTrash size={14} /> ลบคอลัมน์นี้
              </ConfirmSubmitButton>
            </form>

            {!isDoneList && (
              <p className="text-muted border-line mt-1 border-t px-2.5 py-2 text-[11px] leading-4">
                คอลัมน์เสร็จสิ้นคือคอลัมน์ที่ลากการ์ดเข้าไปแล้วได้แต้ม (บอร์ดละ 1 คอลัมน์)
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
