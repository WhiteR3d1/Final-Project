"use client";

import { useState } from "react";
import { Modal } from "@/app/components/ui/modal";
import { ColorPicker, PRESET_COLORS } from "@/app/components/ui/color-picker";
import { SubmitButton } from "@/app/components/ui/buttons";
import { createListAction, updateListAction } from "./actions";
import type { ListWithCards } from "./types";

const fieldClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";
const labelClass = "text-muted mb-1.5 block text-xs font-medium";

/**
 * หน้าต่างสร้าง/แก้ไขคอลัมน์ — ใช้ตัวเดียวกันทั้งสองโหมด
 * ส่ง `list` มา = โหมดแก้ไข, ไม่ส่ง = โหมดสร้างใหม่
 */
export function ListDialog({
  boardId,
  list,
  onClose,
}: {
  boardId: string;
  list?: ListWithCards;
  onClose: () => void;
}) {
  const isEdit = Boolean(list);
  const [color, setColor] = useState(list?.color ?? PRESET_COLORS[0]);

  return (
    <Modal open onClose={onClose} size="sm" title={isEdit ? "แก้ไขคอลัมน์" : "เพิ่มคอลัมน์ใหม่"}>
      <form
        action={async (formData) => {
          await (isEdit ? updateListAction(formData) : createListAction(formData));
          onClose();
        }}
        className="flex flex-col gap-4"
      >
        {isEdit ? (
          <input type="hidden" name="listId" value={list!.id} />
        ) : (
          <input type="hidden" name="boardId" value={boardId} />
        )}

        <div>
          <label className={labelClass} htmlFor="list-name">
            ชื่อคอลัมน์
          </label>
          <input
            id="list-name"
            type="text"
            name="name"
            defaultValue={list?.name ?? ""}
            placeholder="เช่น กำลังทำ"
            required
            autoFocus
            autoComplete="off"
            maxLength={60}
            className={fieldClass}
          />
        </div>

        <div>
          <span className={labelClass}>สี</span>
          <ColorPicker name="color" value={color} onChange={setColor} />
        </div>

        <div>
          <label className={labelClass} htmlFor="list-description">
            คำอธิบาย
          </label>
          <textarea
            id="list-description"
            name="description"
            defaultValue={list?.description ?? ""}
            placeholder="คอลัมน์นี้ใช้ทำอะไร..."
            rows={3}
            maxLength={300}
            className={`${fieldClass} resize-y`}
          />
        </div>

        <div className="border-line flex items-center justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border-line text-muted hover:text-text hover:bg-panel-2 rounded-lg border px-3 py-1.5 text-sm"
          >
            ยกเลิก
          </button>
          <SubmitButton
            pendingLabel="กำลังบันทึก..."
            className="bg-accent text-accent-ink rounded-lg px-4 py-1.5 text-sm font-medium hover:brightness-110"
          >
            {isEdit ? "บันทึก" : "เพิ่มคอลัมน์"}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
