"use client";

import { useState } from "react";
import type { Attachment } from "@/app/generated/prisma/client";
import { ConfirmSubmitButton, SubmitButton } from "@/app/components/ui/buttons";
import { IconFile, IconImage, IconLink, IconTrash } from "@/app/components/ui/icons";
import { MAX_ATTACHMENT_BYTES, formatFileSize } from "@/lib/attachments";
import {
  addLinkAttachmentAction,
  deleteAttachmentAction,
  uploadAttachmentAction,
} from "./actions";

const fieldClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none";
const ghostButtonClass =
  "border-line text-muted hover:text-text hover:bg-panel-2 shrink-0 rounded-lg border px-3 py-1.5 text-xs";

/** ไฟล์แนบของการ์ด — รูปโชว์เป็น thumbnail ส่วนลิงก์/ไฟล์เป็นแถว */
export function CardAttachments({
  cardId,
  attachments,
  canEdit,
}: {
  cardId: string;
  attachments: Attachment[];
  canEdit: boolean;
}) {
  const [sizeError, setSizeError] = useState<string | null>(null);

  const images = attachments.filter((attachment) => attachment.type === "IMAGE");
  const others = attachments.filter((attachment) => attachment.type !== "IMAGE");

  // ด่านแรกให้ผู้ใช้รู้ตัวทันทีตั้งแต่ยังไม่ส่ง — ด่านจริงอยู่ใน uploadAttachmentAction
  function checkSize(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setSizeError(
        `ไฟล์ใหญ่เกินไป (${formatFileSize(file.size)}) — จำกัดที่ ${formatFileSize(MAX_ATTACHMENT_BYTES)}`
      );
      event.currentTarget.value = "";
      return;
    }
    setSizeError(null);
  }

  return (
    <section>
      <h3 className="text-muted mb-2 text-xs font-medium">
        ไฟล์แนบ {attachments.length > 0 && `(${attachments.length})`}
      </h3>

      {attachments.length === 0 && !canEdit && (
        <p className="text-muted text-xs">ยังไม่มีไฟล์แนบ</p>
      )}

      {images.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {images.map((attachment) => (
            <div key={attachment.id} className="group relative">
              <a href={attachment.url} target="_blank" rel="noopener noreferrer" title={attachment.name}>
                {/* ไม่ใช้ next/image เพราะ attachment แบบลิงก์ชี้ไปโฮสต์ไหนก็ได้
                    ซึ่งครอบด้วย images.remotePatterns ไม่ได้ */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="border-line bg-panel-2 h-24 w-full rounded-lg border object-cover"
                />
              </a>
              {canEdit && (
                <form
                  action={deleteAttachmentAction}
                  className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <input type="hidden" name="attachmentId" value={attachment.id} />
                  <ConfirmSubmitButton
                    ariaLabel={`ลบไฟล์แนบ ${attachment.name}`}
                    confirmLabel="ลบ?"
                    className="bg-panel/90 text-muted hover:text-danger rounded-lg p-1"
                    confirmClassName="bg-danger text-danger-ink rounded-lg px-1.5 py-1 text-[11px] font-medium"
                  >
                    <IconTrash size={13} />
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {others.map((attachment) => (
            <li key={attachment.id} className="group flex items-center gap-2">
              <span className="text-muted shrink-0">
                {attachment.type === "LINK" ? <IconLink size={14} /> : <IconFile size={14} />}
              </span>
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text min-w-0 flex-1 truncate text-xs hover:underline"
                title={attachment.url}
              >
                {attachment.name}
              </a>
              {attachment.size !== null && (
                <span className="text-muted shrink-0 text-[11px] tabular-nums">
                  {formatFileSize(attachment.size)}
                </span>
              )}
              {canEdit && (
                <form action={deleteAttachmentAction} className="shrink-0">
                  <input type="hidden" name="attachmentId" value={attachment.id} />
                  <ConfirmSubmitButton
                    ariaLabel={`ลบไฟล์แนบ ${attachment.name}`}
                    confirmLabel="ลบ?"
                    className="text-muted hover:text-danger focus-visible:opacity-100 opacity-0 group-hover:opacity-100"
                    confirmClassName="text-danger text-[11px] font-medium"
                  >
                    <IconTrash size={14} />
                  </ConfirmSubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-col gap-1.5">
          <form action={addLinkAttachmentAction} className="flex items-center gap-1.5">
            <input type="hidden" name="cardId" value={cardId} />
            <input
              type="url"
              name="url"
              placeholder="วางลิงก์ (https://...)"
              autoComplete="off"
              required
              className={fieldClass}
            />
            <SubmitButton pendingLabel="กำลังเพิ่ม..." className={ghostButtonClass}>
              แนบลิงก์
            </SubmitButton>
          </form>

          <form action={uploadAttachmentAction} className="flex items-center gap-1.5">
            <input type="hidden" name="cardId" value={cardId} />
            <input
              type="file"
              name="file"
              required
              onChange={checkSize}
              aria-label="เลือกไฟล์ที่จะแนบ"
              className="text-muted file:border-line file:bg-panel-2 file:text-text min-w-0 flex-1 text-xs file:mr-2 file:rounded-lg file:border file:px-2 file:py-1 file:text-xs"
            />
            <SubmitButton pendingLabel="กำลังอัปโหลด..." className={ghostButtonClass}>
              <span className="flex items-center gap-1.5">
                <IconImage size={13} /> อัปโหลด
              </span>
            </SubmitButton>
          </form>

          {sizeError && <p className="text-danger text-[11px]">{sizeError}</p>}
        </div>
      )}
    </section>
  );
}
