"use client";

import { useActionState, useState } from "react";
import { deleteBoardAction, updateBoardAction } from "@/app/actions/board";
import type { BoardInvite, BoardShareLink, Label, Priority } from "@/app/generated/prisma/client";
import { BoardRole } from "@/app/generated/prisma/enums";
import { Modal } from "@/app/components/ui/modal";
import { ConfirmSubmitButton, SubmitButton } from "@/app/components/ui/buttons";
import { Avatar, displayName } from "@/app/components/ui/avatar";
import { Chip } from "@/app/components/ui/chip";
import { ColorPicker, PRESET_COLORS } from "@/app/components/ui/color-picker";
import { IconPlus, IconSettings, IconTrash } from "@/app/components/ui/icons";
import {
  createInviteAction,
  createLabelAction,
  deleteLabelAction,
  leaveBoardAction,
  linkBoardToCourseAction,
  removeMemberAction,
  setMemberRoleAction,
  type LinkCourseState,
} from "./actions";
import type { PublicUser } from "./types";
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
  owner,
  course,
  members,
  currentUserId,
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
  owner: PublicUser;
  /** รายวิชาที่บอร์ดผูกอยู่ (null = บอร์ดส่วนตัว) */
  course: { name: string; teacherName: string } | null;
  members: { role: BoardRole; user: PublicUser }[];
  currentUserId: string;
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
            <h3 className="text-text mb-2 text-sm font-medium">รายวิชา</h3>
            {course ? (
              <p className="text-muted text-xs leading-5">
                ส่งงานในวิชา <span className="text-text font-medium">{course.name}</span> (อาจารย์{" "}
                {course.teacherName}) — อาจารย์เห็นบอร์ดนี้และต้องอนุมัติก่อนการ์ดเข้าคอลัมน์เสร็จสิ้น
                ถ้าจะถอนออกจากวิชา ให้อาจารย์ผู้สอนเป็นคนถอน
              </p>
            ) : canInvite ? (
              <LinkCourseForm boardId={boardId} />
            ) : (
              <p className="text-muted text-xs">บอร์ดส่วนตัว — ยังไม่ได้ผูกรายวิชา</p>
            )}
          </section>

          <section>
            <h3 className="text-text mb-2 text-sm font-medium">
              สมาชิก ({members.length + 1})
            </h3>
            <ul className="flex flex-col gap-1.5">
              <MemberRow user={owner}>
                <Chip tone="accent">เจ้าของ</Chip>
              </MemberRow>
              {members.map((member) => (
                <MemberRow key={member.user.id} user={member.user}>
                  {canInvite ? (
                    <>
                      {/* เปลี่ยนแล้วส่งทันที ไม่ต้องมีปุ่มบันทึกแยก */}
                      <form action={setMemberRoleAction}>
                        <input type="hidden" name="boardId" value={boardId} />
                        <input type="hidden" name="userId" value={member.user.id} />
                        {/* key ตาม role: React 19 รีเซ็ตฟอร์มหลัง action กลับไปค่า default ตอน mount
                            ถ้าไม่ remount dropdown จะเด้งกลับไปโชว์ role เดิมทั้งที่บันทึกแล้ว */}
                        <select
                          key={member.role}
                          name="role"
                          defaultValue={member.role}
                          onChange={(event) => event.currentTarget.form?.requestSubmit()}
                          aria-label={`สิทธิ์ของ ${displayName(member.user)}`}
                          className={inputClass}
                        >
                          <option value={BoardRole.EDITOR}>แก้ไขได้</option>
                          <option value={BoardRole.VIEWER}>ดูอย่างเดียว</option>
                        </select>
                      </form>
                      <form action={removeMemberAction}>
                        <input type="hidden" name="boardId" value={boardId} />
                        <input type="hidden" name="userId" value={member.user.id} />
                        <ConfirmSubmitButton
                          ariaLabel={`เอา ${displayName(member.user)} ออกจากบอร์ด`}
                          confirmLabel="เอาออก?"
                          className="text-muted hover:text-danger rounded-lg p-1"
                          confirmClassName="text-danger rounded-lg px-1.5 py-1 text-xs font-medium"
                        >
                          <IconTrash size={14} />
                        </ConfirmSubmitButton>
                      </form>
                    </>
                  ) : (
                    <Chip tone="neutral">
                      {member.role === BoardRole.VIEWER ? "ดูอย่างเดียว" : "แก้ไขได้"}
                    </Chip>
                  )}
                </MemberRow>
              ))}
            </ul>
            {canInvite && members.length > 0 && (
              <p className="text-muted mt-2 text-[11px] leading-4">
                คนที่ถูกเอาออกยังกลับเข้ามาได้ถ้าลิงก์แชร์ยังเปิดอยู่ — ปิดหรือสร้างลิงก์ใหม่ด้วยถ้าไม่ต้องการ
              </p>
            )}
            {members.some((member) => member.user.id === currentUserId) && (
              <form action={leaveBoardAction} className="mt-3">
                <input type="hidden" name="boardId" value={boardId} />
                <ConfirmSubmitButton
                  confirmLabel="กดอีกครั้งเพื่อออกจากบอร์ด"
                  className="border-line text-danger hover:bg-danger/10 rounded-lg border px-3 py-1.5 text-xs font-medium"
                  confirmClassName="bg-danger text-danger-ink rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  ออกจากบอร์ดนี้
                </ConfirmSubmitButton>
              </form>
            )}
          </section>

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
          <footer className="border-line mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
            {course ? (
              <p className="text-muted mr-auto text-xs">
                บอร์ดในรายวิชาลบไม่ได้ — ให้อาจารย์ถอนออกจากวิชาก่อน
              </p>
            ) : (
              <form action={deleteBoardAction} className="mr-auto">
                <input type="hidden" name="boardId" value={boardId} />
                <ConfirmSubmitButton
                  confirmLabel="กดอีกครั้งเพื่อลบทั้งบอร์ด"
                  className="border-line text-danger hover:bg-danger/10 hover:border-danger flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
                  confirmClassName="bg-danger text-danger-ink rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  <IconTrash size={15} /> ลบบอร์ดนี้
                </ConfirmSubmitButton>
              </form>
            )}
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

function MemberRow({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Avatar user={user} size={26} />
      <div className="min-w-0 flex-1">
        <div className="text-text truncate text-xs font-medium">{displayName(user)}</div>
        <div className="text-muted truncate text-[11px]">{user.email}</div>
      </div>
      {children}
    </li>
  );
}

/** เจ้าของบอร์ดกรอกรหัสที่อาจารย์ให้มา — ผูกได้ครั้งเดียว ถอนออกได้เฉพาะอาจารย์ */
function LinkCourseForm({ boardId }: { boardId: string }) {
  const [state, action] = useActionState<LinkCourseState, FormData>(linkBoardToCourseAction, undefined);
  // controlled เพราะ React 19 ล้างช่องหลัง action จบ — พิมพ์รหัสผิดแล้วต้องแก้ได้โดยไม่ต้องพิมพ์ใหม่หมด
  const [code, setCode] = useState("");

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="boardId" value={boardId} />
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          name="joinCode"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          maxLength={12}
          autoComplete="off"
          placeholder="รหัสรายวิชาจากอาจารย์ เช่น AB3K9X"
          aria-label="รหัสรายวิชา"
          className={`${inputClass} flex-1 font-mono uppercase`}
        />
        <SubmitButton
          pendingLabel="กำลังผูก..."
          className="bg-accent text-accent-ink rounded-lg px-3 py-1.5 text-xs font-medium hover:brightness-110"
        >
          ผูกรายวิชา
        </SubmitButton>
      </div>
      {state?.error && <p className="text-danger text-xs">{state.error}</p>}
      <p className="text-muted text-[11px] leading-4">
        ผูกแล้วอาจารย์จะเห็นบอร์ดนี้ ให้คะแนนการ์ดที่ส่งตรวจ และเป็นคนอนุมัติการ์ดเข้าคอลัมน์เสร็จสิ้น
        (ถอนออกเองไม่ได้)
      </p>
    </form>
  );
}
