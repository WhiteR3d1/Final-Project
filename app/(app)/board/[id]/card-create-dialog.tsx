"use client";

import { useRef, useState, useTransition } from "react";
import type { Label, Priority, User } from "@/app/generated/prisma/client";
import { Modal } from "@/app/components/ui/modal";
import { IconPlus, IconTrash } from "@/app/components/ui/icons";
import { sanitizeAttachmentUrl } from "@/lib/attachments";
import { createCardAction } from "./actions";
import { CardAssigneeSelect, CardLabelSelect, CardPrioritySelect } from "./card-field-selects";
import { AttachmentUpload, useAttachmentUpload } from "./attachment-upload";

const fieldClass = "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";
const sectionTitleClass = "text-muted mb-2 text-xs font-medium";
const buttonClass = "border-line text-muted hover:text-text hover:bg-panel-2 rounded-lg border px-3 py-1.5 text-xs disabled:opacity-60";
type DraftChecklist = { id: string; title: string; items: { id: string; content: string; isCompleted: boolean }[] };

export function CardCreateDialog({ listId, listName, priorities, labels, members, onClose }: {
  listId: string; listName: string; priorities: Priority[]; labels: Label[]; members: User[]; onClose: () => void;
}) {
  const [priorityId, setPriorityId] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [checklists, setChecklists] = useState<DraftChecklist[]>([]);
  const [links, setLinks] = useState<{ id: string; url: string }[]>([]);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const queue = useAttachmentUpload();

  function toggle(values: string[], id: string) { return values.includes(id) ? values.filter((value) => value !== id) : [...values, id]; }
  function updateChecklist(id: string, update: (checklist: DraftChecklist) => DraftChecklist) {
    setChecklists((previous) => previous.map((checklist) => checklist.id === id ? update(checklist) : checklist));
  }
  function addLink() {
    const url = sanitizeAttachmentUrl(link);
    if (!url) { setError("ใช้ลิงก์ http หรือ https ที่ถูกต้อง"); return; }
    setLinks((previous) => [...previous, { id: crypto.randomUUID(), url }]);
    setLink(""); setError(null);
  }
  function save(data: FormData) {
    if (submitting.current) return;
    const pendingLink = link.trim() ? sanitizeAttachmentUrl(link) : null;
    if (link.trim() && !pendingLink) { setError("ใช้ลิงก์ http หรือ https ที่ถูกต้อง"); return; }
    submitting.current = true;
    requestId.current ??= crypto.randomUUID();
    data.set("requestId", requestId.current);
    data.set("listId", listId);
    data.set("priorityId", priorityId);
    data.set("details", JSON.stringify({ labelIds, assigneeIds, checklists,
      links: [...links.map((entry) => entry.url), ...(pendingLink ? [pendingLink] : [])] }));
    setError(null);
    startTransition(async () => {
      try {
        let createdId = cardId;
        if (!createdId) {
          const result = await createCardAction(data);
          if (!result.ok) { setError(result.error); return; }
          createdId = result.cardId;
          setCardId(createdId);
        }
        if (await queue.upload(createdId)) onClose();
        else setError("สร้างการ์ดแล้ว แต่บางไฟล์อัปโหลดไม่สำเร็จ ลองใหม่ได้โดยไม่สร้างการ์ดซ้ำ");
      } catch {
        setError("การเชื่อมต่อขัดข้อง กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังอยู่");
      } finally { submitting.current = false; }
    });
  }

  return <Modal open size="lg" title={`เพิ่มการ์ดใน "${listName}"`} onClose={onClose} busy={pending}>
    <form onSubmit={(event) => { event.preventDefault(); save(new FormData(event.currentTarget)); }}>
      <fieldset disabled={pending || !!cardId} className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <input name="title" aria-label="ชื่อการ์ด" placeholder="ชื่อการ์ด" required autoFocus autoComplete="off" maxLength={200} className={`${fieldClass} text-base font-semibold`} />
            <textarea name="description" aria-label="รายละเอียดงาน" placeholder="รายละเอียดงาน..." rows={3} maxLength={20000} className={`${fieldClass} resize-y`} />
            <label className="text-muted text-xs">กำหนดส่ง<input type="date" name="dueDate" className={`${fieldClass} mt-2`} /></label>
          </div>
          <section>
            <h3 className={sectionTitleClass}>เช็กลิสต์</h3>
            <div className="flex flex-col gap-3">
              {checklists.map((checklist) => <div key={checklist.id} className="border-line rounded-lg border p-2">
                <div className="mb-2 flex items-center gap-2">
                  <input aria-label="ชื่อเช็กลิสต์" required maxLength={200} value={checklist.title} className={fieldClass}
                    onChange={(event) => updateChecklist(checklist.id, (value) => ({ ...value, title: event.target.value }))} />
                  <button type="button" aria-label={`ลบเช็กลิสต์ ${checklist.title}`} onClick={() => setChecklists((previous) => previous.filter((value) => value.id !== checklist.id))} className="text-muted hover:text-danger p-1"><IconTrash size={14} /></button>
                </div>
                {checklist.items.map((item) => <div key={item.id} className="mb-2 flex items-center gap-2">
                  <input type="checkbox" aria-label={`ทำรายการ ${item.content || "ใหม่"} เสร็จแล้ว`} checked={item.isCompleted}
                    onChange={(event) => updateChecklist(checklist.id, (value) => ({ ...value, items: value.items.map((current) => current.id === item.id ? { ...current, isCompleted: event.target.checked } : current) }))} />
                  <input required maxLength={200} aria-label="รายการเช็กลิสต์" placeholder="เพิ่มงานย่อย..." value={item.content} className={fieldClass}
                    onChange={(event) => updateChecklist(checklist.id, (value) => ({ ...value, items: value.items.map((current) => current.id === item.id ? { ...current, content: event.target.value } : current) }))} />
                  <button type="button" aria-label={`ลบรายการ ${item.content || "ใหม่"}`} className="text-muted hover:text-danger p-1"
                    onClick={() => updateChecklist(checklist.id, (value) => ({ ...value, items: value.items.filter((current) => current.id !== item.id) }))}><IconTrash size={14} /></button>
                </div>)}
                <button type="button" className={buttonClass} onClick={() => updateChecklist(checklist.id, (value) => ({ ...value, items: [...value.items, { id: crypto.randomUUID(), content: "", isCompleted: false }] }))}>+ เพิ่มรายการ</button>
              </div>)}
              <button type="button" className={`${buttonClass} flex w-fit items-center gap-1 border-dashed`}
                onClick={() => setChecklists((previous) => [...previous, { id: crypto.randomUUID(), title: "เช็กลิสต์", items: [] }])}><IconPlus size={13} /> สร้างเช็กลิสต์</button>
            </div>
          </section>
          <section>
            <h3 className={sectionTitleClass}>ไฟล์แนบ</h3>
            <div className="mb-2 flex gap-1.5">
              <input type="url" aria-label="ลิงก์แนบ" placeholder="วางลิงก์ (https://...)" value={link} onChange={(event) => setLink(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }} className={fieldClass} />
              <button type="button" onClick={addLink} className={`${buttonClass} shrink-0`}>แนบลิงก์</button>
            </div>
            <ul className="mb-2 flex flex-col gap-1">{links.map((entry) => <li key={entry.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{entry.url}</span>
              <button type="button" aria-label={`นำลิงก์ ${entry.url} ออก`} onClick={() => setLinks((previous) => previous.filter((value) => value.id !== entry.id))} className="text-muted hover:text-danger p-1"><IconTrash size={14} /></button>
            </li>)}</ul>
            {!cardId && <AttachmentUpload queue={queue} busy={pending} beforeCreate onSelect={queue.select} />}
          </section>
          <section><h3 className={sectionTitleClass}>ความคิดเห็นเริ่มต้น</h3>
            <textarea name="comment" aria-label="ความคิดเห็นเริ่มต้น" placeholder="เขียนความคิดเห็น... (ไม่บังคับ)" rows={2} maxLength={10000} className={fieldClass} />
          </section>
        </div>
        <aside className="flex min-w-0 flex-col gap-5">
          <p className="text-muted text-xs">คอลัมน์ปลายทาง: <span className="text-text">{listName}</span></p>
          <section><h3 className={sectionTitleClass}>ระดับความสำคัญ</h3><CardPrioritySelect priorities={priorities} selectedId={priorityId} canEdit onChange={setPriorityId} /></section>
          <section><h3 className={sectionTitleClass}>ป้ายกำกับ</h3><CardLabelSelect labels={labels} selectedIds={labelIds} canEdit onChange={(id) => setLabelIds((values) => toggle(values, id))} /></section>
          <section><h3 className={sectionTitleClass}>ผู้รับผิดชอบ</h3><CardAssigneeSelect members={members} selectedIds={assigneeIds} canEdit onChange={(id) => setAssigneeIds((values) => toggle(values, id))} /></section>
        </aside>
      </fieldset>
      {cardId && <div className="mt-4"><p className="text-accent mb-2 text-sm">สร้างการ์ดแล้ว</p>
        <AttachmentUpload queue={queue} busy={pending} onSelect={(files) => { const batch = queue.select(files); startTransition(async () => { await queue.upload(cardId, batch); }); }} />
      </div>}
      {error && <p role="alert" className="text-danger mt-4 text-xs">{error}</p>}
      <div className="border-line mt-6 flex items-center justify-between gap-2 border-t pt-4">
        <button type="button" disabled={pending} onClick={onClose} className={buttonClass}>{cardId ? "ปิดและเก็บการ์ด" : "ยกเลิก"}</button>
        <button type="submit" disabled={pending} className="bg-accent text-accent-ink rounded-lg px-5 py-2 text-sm font-medium hover:brightness-110 disabled:opacity-60">
          {pending ? "กำลังบันทึกและอัปโหลด..." : cardId ? queue.files.length ? "ลองอัปโหลดอีกครั้ง" : "เสร็จสิ้น" : "เพิ่มการ์ด"}
        </button>
      </div>
    </form>
  </Modal>;
}
