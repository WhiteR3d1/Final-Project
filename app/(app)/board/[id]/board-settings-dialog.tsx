"use client";

import { useState } from "react";
import { updateBoardAction } from "@/app/actions/board";
import type { BoardInvite, BoardShareLink, Label, Priority } from "@/app/generated/prisma/client";
import { BoardRole } from "@/app/generated/prisma/enums";
import { Modal } from "@/app/components/ui/modal";
import { ConfirmSubmitButton, SubmitButton } from "@/app/components/ui/buttons";
import { ColorPicker, PRESET_COLORS } from "@/app/components/ui/color-picker";
import { IconPlus, IconSettings, IconTrash } from "@/app/components/ui/icons";
import { createInviteAction, createLabelAction, deleteLabelAction } from "./actions";
import { PriorityManager } from "./priority-manager";
import { ShareLinkBox } from "./share-link-box";

const inputClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none";

/** ตั้งค่าบอร์ดทั้งหมดรวมไว้ที่เดียว — เดิมฟอร์มพวกนี้กองอยู่บนหัวหน้าบอร์ด */
export function BoardSettingsDialog({
  boardId,
  boardName,
  boardColor,
  boardDescription,
  labels,
  priorities,
  invites,
  shareLink,
  canEdit,
  canInvite,
}: {
  boardId: string;
  boardName: string;
  boardColor: string | null;
  boardDescription: string | null;
  labels: Label[];
  priorities: Priority[];
  invites: BoardInvite[];
  shareLink: BoardShareLink | null;
  canEdit: boolean;
  canInvite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(boardColor ?? PRESET_COLORS[0]);

  // ปุ่มยืนยันของทั้งฟอร์มอยู่ล่างสุด แต่ section อื่นมีฟอร์มของตัวเองอยู่แล้วและ <form>
  // ซ้อนกันไม่ได้ จึงผูกช่องกรอกเข้ากับฟอร์มที่ footer ด้วย attribute form="<id>" ของ HTML
  const boardInfoFormId = `board-info-${boardId}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-line text-muted hover:text-text hover:bg-panel-2 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs"
      >
        <IconSettings size={14} /> ตั้งค่าบอร์ด
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="ตั้งค่าบอร์ด">
        <div className="flex flex-col gap-6">
          {/* เปลี่ยนตัวตนของบอร์ดเป็นสิทธิ์ระดับเจ้าของ เท่ากับการเชิญสมาชิก */}
          {canInvite && (
            <section>
              <h3 className="text-text mb-2 text-sm font-medium">ข้อมูลบอร์ด</h3>
              <div className="flex flex-col gap-2.5">
                <input
                  form={boardInfoFormId}
                  type="text"
                  name="name"
                  defaultValue={boardName}
                  required
                  maxLength={80}
                  aria-label="ชื่อบอร์ด"
                  className={`${inputClass} w-full font-medium`}
                />
                <ColorPicker
                  form={boardInfoFormId}
                  name="color"
                  value={color}
                  onChange={setColor}
                />
                <textarea
                  form={boardInfoFormId}
                  name="description"
                  defaultValue={boardDescription ?? ""}
                  placeholder="บอร์ดนี้ใช้ทำอะไร..."
                  rows={2}
                  maxLength={300}
                  aria-label="คำอธิบายบอร์ด"
                  className={`${inputClass} w-full resize-y`}
                />
              </div>
            </section>
          )}

          <section>
            <h3 className="text-text mb-2 text-sm font-medium">ป้ายกำกับ</h3>
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {labels.length === 0 && (
                <p className="text-muted text-xs">ยังไม่มีป้ายกำกับในบอร์ดนี้</p>
              )}
              {labels.map((label) => (
                <span
                  key={label.id}
                  className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: `${label.color}22`, color: label.color }}
                >
                  {label.name}
                  {canEdit && (
                    <form action={deleteLabelAction} className="flex">
                      <input type="hidden" name="labelId" value={label.id} />
                      <ConfirmSubmitButton
                        ariaLabel={`ลบป้ายกำกับ ${label.name}`}
                        confirmLabel="ลบ?"
                        className="hover:text-danger focus-visible:opacity-100 opacity-0 group-hover:opacity-100"
                        confirmClassName="text-danger font-medium"
                      >
                        <IconTrash size={12} />
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
            <form action={createLabelAction} className="flex items-center gap-1.5">
              <input type="hidden" name="boardId" value={boardId} />
              <input
                type="text"
                name="name"
                placeholder="ชื่อป้ายกำกับใหม่"
                required
                className={`${inputClass} flex-1`}
              />
              <input
                type="color"
                name="color"
                defaultValue="#8b7cff"
                className="border-line bg-panel-2 h-7 w-9 cursor-pointer rounded-lg border"
              />
              <SubmitButton
                ariaLabel="เพิ่มป้ายกำกับ"
                className="bg-panel-2 text-text hover:bg-line flex h-7 w-7 items-center justify-center rounded-lg"
              >
                <IconPlus size={14} />
              </SubmitButton>
            </form>
            )}
          </section>

          <section>
            <h3 className="text-text mb-2 text-sm font-medium">ระดับความสำคัญ</h3>
            <PriorityManager boardId={boardId} priorities={priorities} canEdit={canEdit} />
          </section>

          <section>
            <h3 className="text-text mb-2 text-sm font-medium">เชิญสมาชิก</h3>
            {canInvite ? (
              <div className="flex flex-col gap-3">
              <ShareLinkBox boardId={boardId} shareLink={shareLink} />

              <div className="border-line border-t pt-3">
              <p className="text-muted mb-2 text-xs">หรือเชิญรายอีเมล</p>
              <form action={createInviteAction} className="flex flex-wrap items-center gap-1.5">
                <input type="hidden" name="boardId" value={boardId} />
                <input
                  type="email"
                  name="email"
                  placeholder="อีเมลที่ต้องการเชิญ"
                  required
                  className={`${inputClass} min-w-40 flex-1`}
                />
                <select
                  name="role"
                  defaultValue={BoardRole.EDITOR}
                  aria-label="สิทธิ์ของผู้ถูกเชิญ"
                  className={inputClass}
                >
                  <option value={BoardRole.EDITOR}>แก้ไขได้</option>
                  <option value={BoardRole.VIEWER}>ดูอย่างเดียว</option>
                </select>
                <SubmitButton
                  pendingLabel="กำลังสร้างลิงก์..."
                  className="bg-accent text-accent-ink rounded-lg px-3 py-1.5 text-xs font-medium hover:brightness-110"
                >
                  สร้างลิงก์เชิญ
                </SubmitButton>
              </form>
              </div>
              </div>
            ) : (
              <p className="text-muted text-xs">เฉพาะเจ้าของบอร์ดเท่านั้นที่เชิญสมาชิกได้</p>
            )}

            {invites.length > 0 && (
              <div className="border-warn/30 bg-warn/10 mt-3 rounded-xl border p-3">
                <p className="text-warn mb-1.5 text-xs font-medium">คำเชิญที่รอตอบรับ</p>
                <ul className="flex flex-col gap-1">
                  {invites.map((invite) => (
                    <li key={invite.id} className="text-muted text-xs break-all">
                      {invite.email} ({invite.role === BoardRole.VIEWER ? "ดูอย่างเดียว" : "แก้ไขได้"}){" "}
                      → <span className="font-mono">/invite/{invite.token}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        {/* ปุ่มของ section อื่นทำงานทันทีอยู่แล้ว จึงคงไว้ inline — footer มีแค่ปุ่มยืนยันของทั้งฟอร์ม */}
        {canInvite && (
          <footer className="border-line mt-6 flex items-center justify-end border-t pt-4">
            <form id={boardInfoFormId} action={updateBoardAction}>
              <input type="hidden" name="boardId" value={boardId} />
              <SubmitButton
                pendingLabel="กำลังบันทึก..."
                className="bg-accent text-accent-ink rounded-lg px-5 py-1.5 text-sm font-medium hover:brightness-110"
              >
                บันทึกข้อมูลบอร์ด
              </SubmitButton>
            </form>
          </footer>
        )}
      </Modal>
    </>
  );
}
