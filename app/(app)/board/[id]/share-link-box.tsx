"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { BoardShareLink } from "@/app/generated/prisma/client";
import { BoardRole } from "@/app/generated/prisma/enums";
import { ConfirmSubmitButton, SubmitButton } from "@/app/components/ui/buttons";
import { Toast } from "@/app/components/ui/toast";
import { IconCopy, IconLink } from "@/app/components/ui/icons";
import { regenerateShareLinkAction, updateShareLinkAction } from "./actions";

const controlClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none";
const ghostButtonClass =
  "border-line text-muted hover:text-text hover:bg-panel-2 rounded-lg border px-3 py-1.5 text-xs";

// origin ไม่เปลี่ยนระหว่างอยู่หน้าเดียว จึงไม่มีอะไรต้อง subscribe จริง ๆ
const subscribeToOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

/**
 * ลิงก์ "ใครมีลิงก์ก็เข้าได้" แบบ Google Drive — เห็นเฉพาะเจ้าของบอร์ด
 * ตอนลิงก์ปิดอยู่จะไม่โชว์ URL เลย จะได้ไม่เผลอส่งลิงก์ที่กดแล้วเข้าไม่ได้
 */
export function ShareLinkBox({
  boardId,
  shareLink,
}: {
  boardId: string;
  shareLink: BoardShareLink | null;
}) {
  const [copied, setCopied] = useState(false);

  // ประกอบ URL ฝั่ง client จะได้ไม่ต้องตั้ง env base URL เพิ่ม — ใช้ useSyncExternalStore
  // เพราะมันมี snapshot ฝั่ง server แยกให้ hydration ไม่พัง โดยไม่ต้อง setState ใน effect
  const origin = useSyncExternalStore(subscribeToOrigin, getOrigin, getServerOrigin);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const enabled = Boolean(shareLink?.enabled);
  const role = shareLink?.role ?? BoardRole.EDITOR;
  const url = shareLink ? `${origin}/invite/${shareLink.token}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // clipboard ใช้ได้เฉพาะบน https หรือ localhost — ที่อื่นให้ผู้ใช้ลากคลุมเอง
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted flex items-center gap-1.5 text-xs">
        <IconLink size={13} /> ลิงก์ทั่วไป
      </p>

      {enabled && shareLink ? (
        <>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={url}
              readOnly
              aria-label="ลิงก์สำหรับแชร์บอร์ด"
              onFocus={(event) => event.currentTarget.select()}
              className={`${controlClass} min-w-0 flex-1 font-mono`}
            />
            <button type="button" onClick={copyLink} className={ghostButtonClass}>
              <span className="flex items-center gap-1.5">
                <IconCopy size={13} /> คัดลอก
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <form action={updateShareLinkAction} className="flex items-center gap-1.5">
              <input type="hidden" name="boardId" value={boardId} />
              <input type="hidden" name="enabled" value="1" />
              <label className="text-muted text-xs" htmlFor={`share-role-${boardId}`}>
                ใครก็ตามที่มีลิงก์
              </label>
              <select
                id={`share-role-${boardId}`}
                name="role"
                defaultValue={role}
                className={controlClass}
              >
                <option value={BoardRole.EDITOR}>แก้ไขได้</option>
                <option value={BoardRole.VIEWER}>ดูอย่างเดียว</option>
              </select>
              <SubmitButton pendingLabel="กำลังบันทึก..." className={ghostButtonClass}>
                บันทึกสิทธิ์
              </SubmitButton>
            </form>

            <form action={updateShareLinkAction}>
              <input type="hidden" name="boardId" value={boardId} />
              <input type="hidden" name="enabled" value="0" />
              <input type="hidden" name="role" value={role} />
              <SubmitButton pendingLabel="กำลังปิด..." className={ghostButtonClass}>
                ปิดลิงก์
              </SubmitButton>
            </form>

            <form action={regenerateShareLinkAction}>
              <input type="hidden" name="boardId" value={boardId} />
              <ConfirmSubmitButton
                confirmLabel="กดอีกครั้ง ลิงก์เดิมจะใช้ไม่ได้"
                className={ghostButtonClass}
                confirmClassName={`${ghostButtonClass} text-danger border-danger`}
              >
                สร้างลิงก์ใหม่
              </ConfirmSubmitButton>
            </form>
          </div>
        </>
      ) : (
        <form action={updateShareLinkAction} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="enabled" value="1" />
          <p className="text-muted w-full text-xs">
            ยังไม่ได้เปิดลิงก์ทั่วไป — เปิดแล้วทุกคนที่มีลิงก์จะเข้าบอร์ดนี้ได้เอง
          </p>
          <select name="role" defaultValue={role} aria-label="สิทธิ์ของคนที่เข้าผ่านลิงก์" className={controlClass}>
            <option value={BoardRole.EDITOR}>แก้ไขได้</option>
            <option value={BoardRole.VIEWER}>ดูอย่างเดียว</option>
          </select>
          <SubmitButton
            pendingLabel="กำลังเปิด..."
            className="bg-accent text-accent-ink rounded-lg px-3 py-1.5 text-xs font-medium hover:brightness-110"
          >
            เปิดลิงก์
          </SubmitButton>
        </form>
      )}

      {copied && <Toast>คัดลอกลิงก์แล้ว</Toast>}
    </div>
  );
}
