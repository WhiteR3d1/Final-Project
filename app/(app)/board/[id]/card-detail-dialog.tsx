"use client";

import type { Label, Priority, User } from "@/app/generated/prisma/client";
import { Modal } from "@/app/components/ui/modal";
import { Avatar, displayName } from "@/app/components/ui/avatar";
import { Chip } from "@/app/components/ui/chip";
import { ConfirmSubmitButton, SubmitButton } from "@/app/components/ui/buttons";
import { IconCheck, IconTrash } from "@/app/components/ui/icons";
import { dueLabel, formatDueThai } from "@/lib/due";
import {
  addChecklistItemAction,
  addCommentAction,
  createChecklistAction,
  deleteCardAction,
  deleteChecklistItemAction,
  toggleChecklistItemAction,
  updateCardAction,
} from "./actions";
import {
  CardAssigneeSelect,
  CardLabelSelect,
  CardPrioritySelect,
} from "./card-field-selects";
import { CardAttachments } from "./card-attachments";
import { CardMoveButtons } from "./card-move-buttons";
import type { CardWithRelations } from "./types";

const fieldClass =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";
const sectionTitleClass = "text-muted mb-2 text-xs font-medium";

/** หน้าต่างรายละเอียดการ์ด — รวมทุกการแก้ไขที่เคยกระจายอยู่บนหน้าบอร์ด */
export function CardDetailDialog({
  card,
  listName,
  listIndex,
  totalLists,
  boardLabels,
  boardMembers,
  boardPriorities,
  canEdit,
  onClose,
  onAwarded,
}: {
  card: CardWithRelations;
  listName: string;
  listIndex: number;
  totalLists: number;
  boardLabels: Label[];
  boardMembers: User[];
  boardPriorities: Priority[];
  canEdit: boolean;
  onClose: () => void;
  onAwarded: (points: number) => void;
}) {
  const items = card.checklists.flatMap((checklist) => checklist.items);
  const doneItems = items.filter((item) => item.isCompleted).length;

  // ปุ่ม "บันทึก" อยู่ที่ footer คู่กับปุ่มลบ แต่ <form> ซ้อนกันไม่ได้ (ปุ่มลบเป็นอีกฟอร์ม)
  // จึงผูกช่องกรอกเข้ากับฟอร์มที่อยู่คนละที่ในเอกสารด้วย attribute form="<id>" ของ HTML
  const editFormId = `card-edit-${card.id}`;

  return (
    <Modal open onClose={onClose} size="lg" title="รายละเอียดการ์ด">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
        {/* ---------- คอลัมน์ซ้าย: เนื้อหาการ์ด ---------- */}
        <div className="flex flex-col gap-5">
          {canEdit ? (
            <div className="flex flex-col gap-2">
              <input
                form={editFormId}
                type="text"
                name="title"
                defaultValue={card.title}
                required
                aria-label="ชื่อการ์ด"
                className={`${fieldClass} text-base font-semibold`}
              />
              <textarea
                form={editFormId}
                name="description"
                defaultValue={card.description ?? ""}
                placeholder="รายละเอียดงาน..."
                rows={3}
                aria-label="รายละเอียดงาน"
                className={`${fieldClass} resize-y`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-muted text-xs" htmlFor="dueDate">
                  กำหนดส่ง
                </label>
                <input
                  form={editFormId}
                  id="dueDate"
                  type="date"
                  name="dueDate"
                  defaultValue={card.dueDate ? card.dueDate.toISOString().slice(0, 10) : ""}
                  className={`${fieldClass} w-auto py-1.5`}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="text-text text-base font-semibold">{card.title}</h3>
              {card.description ? (
                <p className="text-muted text-sm whitespace-pre-wrap">{card.description}</p>
              ) : (
                <p className="text-muted text-sm italic">ไม่มีรายละเอียด</p>
              )}
              {card.dueDate && (
                <p className="text-muted text-xs">
                  กำหนดส่ง <span className="text-text">{formatDueThai(card.dueDate, true)}</span>
                </p>
              )}
            </div>
          )}

          {/* ---------- checklist ---------- */}
          <section>
            <h3 className={sectionTitleClass}>
              เช็กลิสต์ {items.length > 0 && `(${doneItems}/${items.length})`}
            </h3>

            {card.checklists.length === 0 ? (
              canEdit ? (
                <form action={createChecklistAction}>
                  <input type="hidden" name="cardId" value={card.id} />
                  <SubmitButton className="border-line text-muted hover:text-text rounded-lg border border-dashed px-3 py-1.5 text-xs">
                    + สร้างเช็กลิสต์
                  </SubmitButton>
                </form>
              ) : (
                <p className="text-muted text-xs">ยังไม่มีเช็กลิสต์</p>
              )
            ) : (
              card.checklists.map((checklist) => (
                <div key={checklist.id} className="flex flex-col gap-1">
                  {checklist.items.map((item) => (
                    <div key={item.id} className="group flex items-center gap-2">
                      {canEdit ? (
                        <form action={toggleChecklistItemAction} className="flex">
                          <input type="hidden" name="itemId" value={item.id} />
                          <SubmitButton
                            ariaLabel={item.isCompleted ? "ยกเลิกการติ๊ก" : "ติ๊กว่าเสร็จ"}
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              item.isCompleted
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-line text-transparent"
                            }`}
                          >
                            <IconCheck size={11} />
                          </SubmitButton>
                        </form>
                      ) : (
                        <span
                          aria-hidden="true"
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            item.isCompleted
                              ? "border-accent bg-accent text-accent-ink"
                              : "border-line text-transparent"
                          }`}
                        >
                          <IconCheck size={11} />
                        </span>
                      )}
                      <span
                        className={`flex-1 text-sm ${
                          item.isCompleted ? "text-muted line-through" : "text-text"
                        }`}
                      >
                        {item.content}
                      </span>
                      {canEdit && (
                        <form action={deleteChecklistItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <SubmitButton
                            ariaLabel="ลบรายการ"
                            className="text-muted hover:text-danger focus-visible:opacity-100 opacity-0 group-hover:opacity-100"
                          >
                            <IconTrash size={14} />
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <form action={addChecklistItemAction} className="mt-1">
                      <input type="hidden" name="checklistId" value={checklist.id} />
                      <input
                        type="text"
                        name="content"
                        placeholder="+ เพิ่มรายการ"
                        autoComplete="off"
                        className={`${fieldClass} py-1.5 text-xs`}
                      />
                    </form>
                  )}
                </div>
              ))
            )}
          </section>

          {/* ---------- ไฟล์แนบ ---------- */}
          <CardAttachments cardId={card.id} attachments={card.attachments} canEdit={canEdit} />

          {/* ---------- คอมเมนต์ ---------- */}
          <section>
            <h3 className={sectionTitleClass}>ความคิดเห็น ({card.comments.length})</h3>
            <div className="flex flex-col gap-2.5">
              {card.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <Avatar user={comment.user} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="text-text text-xs font-medium">
                      {displayName(comment.user)}
                    </div>
                    <div className="text-muted text-sm break-words">{comment.content}</div>
                  </div>
                </div>
              ))}
              {canEdit ? (
                <form action={addCommentAction}>
                  <input type="hidden" name="cardId" value={card.id} />
                  <input
                    type="text"
                    name="content"
                    placeholder="เขียนความคิดเห็น..."
                    autoComplete="off"
                    className={`${fieldClass} py-1.5 text-xs`}
                  />
                </form>
              ) : (
                card.comments.length === 0 && (
                  <p className="text-muted text-xs">ยังไม่มีความคิดเห็น</p>
                )
              )}
            </div>
          </section>
        </div>

        {/* ---------- คอลัมน์ขวา: คุณสมบัติ ---------- */}
        <aside className="flex flex-col gap-5">
          <section>
            <h3 className={sectionTitleClass}>สถานะ</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone={card.isCompleted ? "accent" : "neutral"}>
                {card.isCompleted ? "เสร็จแล้ว" : "กำลังทำ"}
              </Chip>
              {card.dueDate && (
                <Chip tone="neutral" title={dueLabel(card.dueDate)}>
                  ส่ง {formatDueThai(card.dueDate, true)}
                </Chip>
              )}
            </div>
            <p className="text-muted mt-2 text-xs">
              คอลัมน์ปัจจุบัน: <span className="text-text">{listName}</span>
            </p>
            {canEdit && (
              <CardMoveButtons
                cardId={card.id}
                canMoveLeft={listIndex > 0}
                canMoveRight={listIndex < totalLists - 1}
                onAwarded={onAwarded}
              />
            )}
          </section>

          <section>
            <h3 className={sectionTitleClass}>ระดับความสำคัญ</h3>
            <CardPrioritySelect
              cardId={card.id}
              priorities={boardPriorities}
              selectedId={card.priorityId}
              canEdit={canEdit}
            />
          </section>

          <section>
            <h3 className={sectionTitleClass}>ป้ายกำกับ</h3>
            <CardLabelSelect
              cardId={card.id}
              labels={boardLabels}
              selectedIds={card.labels.map((cardLabel) => cardLabel.labelId)}
              canEdit={canEdit}
            />
          </section>

          <section>
            <h3 className={sectionTitleClass}>ผู้รับผิดชอบ</h3>
            <CardAssigneeSelect
              cardId={card.id}
              members={boardMembers}
              selectedIds={card.assignees.map((assignee) => assignee.userId)}
              canEdit={canEdit}
            />
          </section>

        </aside>
      </div>

      {canEdit && (
      <footer className="border-line mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
        <form action={deleteCardAction} className="mr-auto">
          <input type="hidden" name="cardId" value={card.id} />
          <ConfirmSubmitButton
            confirmLabel="กดอีกครั้งเพื่อลบ"
            className="border-line text-danger hover:bg-danger/10 hover:border-danger flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
            confirmClassName="bg-danger text-danger-ink rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            <IconTrash size={15} /> ลบการ์ดนี้
          </ConfirmSubmitButton>
        </form>

        <form id={editFormId} action={updateCardAction}>
          <input type="hidden" name="cardId" value={card.id} />
          <input type="hidden" name="priorityId" value={card.priorityId ?? ""} />
          <SubmitButton
            pendingLabel="กำลังบันทึก..."
            className="bg-accent text-accent-ink rounded-lg px-5 py-1.5 text-sm font-medium hover:brightness-110"
          >
            บันทึก
          </SubmitButton>
        </form>
      </footer>
      )}
    </Modal>
  );
}
