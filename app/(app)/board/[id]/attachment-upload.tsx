"use client";

import { useEffect, useRef, useState } from "react";
import { IconImage, IconTrash } from "@/app/components/ui/icons";
import { MAX_ATTACHMENT_BYTES, formatFileSize, isWithinAttachmentSizeLimit } from "@/lib/attachments";
import { uploadAttachmentAction } from "./actions";

type QueuedFile = { id: string; file: File; status: "waiting" | "uploading" | "failed"; error?: string };

export function useAttachmentUpload() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const uploading = useRef(false);

  function select(selected: File[]) {
    const valid: QueuedFile[] = [];
    const invalid: string[] = [];
    for (const file of selected) {
      if (!isWithinAttachmentSizeLimit(file.size)) {
        invalid.push(`${file.name}: ไฟล์ต้องมีข้อมูลและมีขนาดไม่เกิน ${formatFileSize(MAX_ATTACHMENT_BYTES)}`);
      } else valid.push({ id: crypto.randomUUID(), file, status: "waiting" });
    }
    setErrors(invalid);
    setFiles((previous) => [...previous, ...valid]);
    return valid;
  }

  async function upload(cardId: string, batch = files) {
    if (uploading.current) return false;
    uploading.current = true;
    let success = true;
    try {
      for (const entry of batch) {
        setFiles((previous) => previous.map((item) => item.id === entry.id ? { ...item, status: "uploading", error: undefined } : item));
        try {
          const data = new FormData();
          data.set("cardId", cardId);
          data.set("attachmentId", entry.id);
          data.set("file", entry.file);
          const result = await uploadAttachmentAction(data);
          if (!result.ok) throw new Error(result.error);
          setFiles((previous) => previous.filter((item) => item.id !== entry.id));
        } catch (error) {
          success = false;
          setFiles((previous) => previous.map((item) => item.id === entry.id ? {
            ...item, status: "failed", error: error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง",
          } : item));
        }
      }
    } finally { uploading.current = false; }
    return success;
  }

  return { files, errors, select, upload, remove: (id: string) => setFiles((previous) => previous.filter((file) => file.id !== id)) };
}

function FilePreview({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!file.type.startsWith("image/")) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={file.name} className="border-line h-16 w-16 rounded-lg border object-cover" />;
}

export function AttachmentUpload({ queue, busy, beforeCreate = false, onSelect, onRetry }: {
  queue: ReturnType<typeof useAttachmentUpload>; busy: boolean; beforeCreate?: boolean;
  onSelect: (files: File[]) => void; onRetry?: () => void;
}) {
  return <div className="flex flex-col gap-2">
    <label className={`border-line text-muted hover:text-text focus-within:ring-accent relative flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs focus-within:ring-2 ${busy ? "opacity-60" : ""}`}>
      <IconImage size={13} /> แนบไฟล์
      <input type="file" multiple disabled={busy} aria-label="เลือกไฟล์ที่จะแนบ" className="sr-only"
        onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; onSelect(files); }} />
    </label>
    <p className="text-muted text-[11px]">เลือกได้หลายไฟล์ ไม่เกิน {formatFileSize(MAX_ATTACHMENT_BYTES)} ต่อไฟล์{beforeCreate ? " · อัปโหลดอัตโนมัติเมื่อเพิ่มการ์ด" : " · อัปโหลดทันทีที่เลือก"}</p>
    <ul className="flex flex-col gap-2" aria-live="polite" aria-busy={busy}>
      {queue.files.map((entry) => <li key={entry.id} className="border-line flex items-center gap-2 rounded-lg border p-2 text-xs">
        <FilePreview file={entry.file} />
        <div className="min-w-0 flex-1">
          <p className="truncate">{entry.file.name} <span className="text-muted">({formatFileSize(entry.file.size)})</span></p>
          <p className={entry.status === "failed" ? "text-danger" : "text-muted"}>
            {entry.status === "failed" ? entry.error : entry.status === "uploading" ? "กำลังอัปโหลด..." : beforeCreate ? "รอสร้างการ์ด" : "รออัปโหลด"}
          </p>
        </div>
        <button type="button" disabled={busy} aria-label={`นำ ${entry.file.name} ออกจากรายการ`} onClick={() => queue.remove(entry.id)} className="text-muted hover:text-danger p-1"><IconTrash size={14} /></button>
      </li>)}
    </ul>
    {queue.errors.length > 0 && <ul role="alert" className="text-danger text-[11px]">{queue.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    {onRetry && queue.files.some((file) => file.status === "failed") && <button type="button" disabled={busy} onClick={onRetry} className="text-accent self-start text-xs">ลองอัปโหลดไฟล์ที่ไม่สำเร็จอีกครั้ง</button>}
  </div>;
}
