"use client";

import { useActionState, useRef, useState, type KeyboardEvent } from "react";
import { Modal } from "@/app/components/ui/modal";
import { SubmitButton } from "@/app/components/ui/buttons";
import { IconChevronDown, IconPlus, IconTrash } from "@/app/components/ui/icons";
import { saveAssignmentAction, type AssignmentFormState } from "../actions";

export type AssignmentDraft = {
  id: string;
  title: string;
  description: string;
  /** YYYY-MM-DD หรือ "" */
  dueDate: string;
  published: boolean;
  items: { id: string; content: string }[];
};

type ItemRow = { key: string; id?: string; content: string };

const fieldClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";
const iconButtonClass =
  "text-muted hover:text-text disabled:hover:text-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-md disabled:opacity-30";

/** ปุ่มที่เปิด dialog สร้าง/แก้งาน — dialog mount ใหม่ทุกครั้งที่เปิด ค่าในฟอร์มจึงตรงกับข้อมูลล่าสุดเสมอ */
export function AssignmentEditorButton({
  courseId,
  assignment,
  label,
  className,
}: {
  courseId: string;
  assignment?: AssignmentDraft;
  label: React.ReactNode;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open && <AssignmentDialog courseId={courseId} assignment={assignment} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * ฟอร์มงานที่มอบหมาย — ทุกช่องเป็น controlled เพราะ React 19 รีเซ็ตฟอร์มหลัง action
 * (ถ้า error ต้องไม่ทำงานย่อยที่พิมพ์ไว้หาย) ส่งทั้งก้อนเป็น JSON ใน payload ช่องเดียว
 */
function AssignmentDialog({
  courseId,
  assignment,
  onClose,
}: {
  courseId: string;
  assignment?: AssignmentDraft;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(assignment?.title ?? "");
  const [description, setDescription] = useState(assignment?.description ?? "");
  const [dueDate, setDueDate] = useState(assignment?.dueDate ?? "");
  const [items, setItems] = useState<ItemRow[]>(
    () => assignment?.items.map((item) => ({ key: item.id, id: item.id, content: item.content })) ?? []
  );
  const [newItem, setNewItem] = useState("");
  const nextKey = useRef(0);

  // ปิดเองเมื่อบันทึกสำเร็จ — ทำใน action เลย ไม่ต้องมี effect คอยดู state
  const [state, action, pending] = useActionState<AssignmentFormState, FormData>(async (previous, formData) => {
    const result = await saveAssignmentAction(previous, formData);
    if (result?.savedAt) onClose();
    return result;
  }, undefined);

  const addItem = () => {
    const content = newItem.trim();
    if (!content) return;
    nextKey.current += 1;
    setItems((rows) => [...rows, { key: `new-${nextKey.current}`, content }]);
    setNewItem("");
  };
  const move = (index: number, delta: -1 | 1) => {
    setItems((rows) => {
      const next = [...rows];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  };
  // Enter ในช่องงานย่อยต้องไม่ส่งฟอร์มทั้งก้อน
  const stopSubmit = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.preventDefault();
  };

  // ข้อที่พิมพ์ค้างในช่องเพิ่มแต่ยังไม่กด Enter ก็นับด้วย — ไม่งั้นกดบันทึกแล้วข้อนั้นหายเงียบ ๆ
  const payload = JSON.stringify({
    title,
    description,
    dueDate,
    items: [
      ...items.map(({ id, content }) => ({ id, content })),
      ...(newItem.trim() ? [{ content: newItem }] : []),
    ],
  });

  return (
    <Modal open onClose={onClose} busy={pending} size="lg" title={assignment ? "แก้ไขงานที่มอบหมาย" : "สร้างงานที่มอบหมาย"}>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="courseId" value={courseId} />
        {assignment && <input type="hidden" name="assignmentId" value={assignment.id} />}
        <input type="hidden" name="payload" value={payload} />

        {assignment?.published && (
          <p className="bg-warn/10 text-warn rounded-lg px-3 py-2 text-xs leading-5">
            งานนี้แจกแล้ว — บันทึกแล้วการ์ดในทุกบอร์ดจะเปลี่ยนตาม ข้อที่ลบจะหายจากทุกบอร์ด
            ส่วนข้อที่แค่แก้คำ ติ๊กเดิมของนักศึกษายังอยู่
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-xs">ชื่องาน</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={200}
            placeholder="เช่น เครื่องคิดเลขด้วย Python"
            className={`${fieldClass} font-semibold`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-xs">รายละเอียด / โจทย์</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="อธิบายโจทย์ เกณฑ์การให้คะแนน หรือสิ่งที่ต้องส่ง"
            className={`${fieldClass} resize-y`}
          />
        </label>

        <label className="flex flex-wrap items-center gap-2">
          <span className="text-muted text-xs">กำหนดส่ง</span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={`${fieldClass} w-auto py-1.5`}
          />
          {dueDate && (
            <button type="button" onClick={() => setDueDate("")} className="text-muted hover:text-text text-xs underline">
              ไม่กำหนด
            </button>
          )}
        </label>

        <section className="flex flex-col gap-1.5">
          <h3 className="text-muted text-xs">
            งานย่อย {items.length > 0 && `(${items.length} ข้อ)`} — นักศึกษาติ๊กได้ แต่แก้หรือลบไม่ได้
          </h3>
          {items.length > 0 && (
            <ol className="flex flex-col gap-1">
              {items.map((row, index) => (
                <li key={row.key} className="flex items-center gap-1">
                  <span className="text-muted w-5 shrink-0 text-right text-xs tabular-nums">{index + 1}.</span>
                  <input
                    type="text"
                    value={row.content}
                    onChange={(event) =>
                      setItems((rows) =>
                        rows.map((item) => (item.key === row.key ? { ...item, content: event.target.value } : item))
                      )
                    }
                    onKeyDown={stopSubmit}
                    maxLength={300}
                    aria-label={`งานย่อยข้อ ${index + 1}`}
                    className={`${fieldClass} py-1.5`}
                  />
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`เลื่อนข้อ ${index + 1} ขึ้น`}
                    className={iconButtonClass}
                  >
                    <IconChevronDown size={15} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`เลื่อนข้อ ${index + 1} ลง`}
                    className={iconButtonClass}
                  >
                    <IconChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems((rows) => rows.filter((item) => item.key !== row.key))}
                    aria-label={`ลบข้อ ${index + 1}`}
                    className={`${iconButtonClass} hover:text-danger`}
                  >
                    <IconTrash size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addItem();
              }}
              maxLength={300}
              placeholder="พิมพ์งานย่อยแล้วกด Enter เช่น รับตัวเลข 2 ตัวจากผู้ใช้"
              aria-label="เพิ่มงานย่อย"
              className={`${fieldClass} py-1.5`}
            />
            <button
              type="button"
              onClick={addItem}
              disabled={!newItem.trim()}
              aria-label="เพิ่มงานย่อย"
              className={iconButtonClass}
            >
              <IconPlus size={16} />
            </button>
          </div>
        </section>

        {state?.error && <p className="text-danger text-xs">{state.error}</p>}

        <footer className="border-line flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          {!assignment?.published && (
            <p className="text-muted mr-auto text-xs">บันทึกเป็นร่างก่อน นักศึกษาจะเห็นเมื่อกด &ldquo;แจกงาน&rdquo;</p>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="border-line text-muted hover:text-text rounded-lg border px-4 py-1.5 text-sm"
          >
            ยกเลิก
          </button>
          <SubmitButton
            pendingLabel="กำลังบันทึก..."
            className="bg-accent text-accent-ink rounded-lg px-5 py-1.5 text-sm font-medium hover:brightness-110"
          >
            {assignment?.published ? "บันทึกและอัปเดตทุกบอร์ด" : assignment ? "บันทึกร่าง" : "บันทึกเป็นร่าง"}
          </SubmitButton>
        </footer>
      </form>
    </Modal>
  );
}
