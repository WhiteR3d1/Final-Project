"use client";

import { useState } from "react";
import type { Priority } from "@/app/generated/prisma/client";
import { Modal } from "@/app/components/ui/modal";
import { SubmitButton } from "@/app/components/ui/buttons";
import { createCardAction } from "./actions";

const fieldClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";
const labelClass = "text-muted mb-1.5 block text-xs font-medium";

/** หน้าต่างเพิ่มการ์ด — ตั้งค่าที่จำเป็นได้ตั้งแต่ตอนสร้าง ไม่ต้องสร้างแล้วค่อยเปิดไปแก้ */
export function CardCreateDialog({
  listId,
  listName,
  priorities,
  onClose,
}: {
  listId: string;
  listName: string;
  priorities: Priority[];
  onClose: () => void;
}) {
  const [priorityId, setPriorityId] = useState("");

  return (
    <Modal open onClose={onClose} size="sm" title={`เพิ่มการ์ดใน "${listName}"`}>
      <form
        action={async (formData) => {
          await createCardAction(formData);
          onClose();
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="listId" value={listId} />
        <input type="hidden" name="priorityId" value={priorityId} />

        <div>
          <label className={labelClass} htmlFor="card-title">
            ชื่อการ์ด
          </label>
          <input
            id="card-title"
            type="text"
            name="title"
            placeholder="เช่น ทำสไลด์นำเสนอ"
            required
            autoFocus
            autoComplete="off"
            maxLength={200}
            className={`${fieldClass} font-medium`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="card-description">
            รายละเอียด
          </label>
          <textarea
            id="card-description"
            name="description"
            placeholder="รายละเอียดงาน..."
            rows={3}
            className={`${fieldClass} resize-y`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="card-due">
            กำหนดส่ง
          </label>
          <input id="card-due" type="date" name="dueDate" className={`${fieldClass} w-auto`} />
        </div>

        <div>
          <span className={labelClass}>ระดับความสำคัญ</span>
          {priorities.length === 0 ? (
            <p className="text-muted text-xs">ยังไม่มีระดับความสำคัญในบอร์ดนี้</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {priorities.map((priority) => {
                const isActive = priorityId === priority.id;
                return (
                  <button
                    key={priority.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setPriorityId(isActive ? "" : priority.id)}
                    // สีมาจากที่ผู้ใช้ตั้งเองใน DB จึงต้องใส่ผ่าน style
                    style={
                      isActive
                        ? { backgroundColor: `${priority.color}22`, color: priority.color }
                        : { borderColor: priority.color, color: priority.color }
                    }
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      isActive ? "" : "border border-dashed opacity-70 hover:opacity-100"
                    }`}
                  >
                    {priority.name}
                  </button>
                );
              })}
            </div>
          )}
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
            pendingLabel="กำลังเพิ่ม..."
            className="bg-accent text-accent-ink rounded-lg px-4 py-1.5 text-sm font-medium hover:brightness-110"
          >
            เพิ่มการ์ด
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
