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
  setCardPriorityAction,
  toggleCardAssigneeAction,
  toggleCardLabelAction,
  toggleChecklistItemAction,
  updateCardAction,
} from "./actions";
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
  onClose: () => void;
  onAwarded: (points: number) => void;
}) {
  const items = card.checklists.flatMap((checklist) => checklist.items);
  const doneItems = items.filter((item) => item.isCompleted).length;

  return (
    <Modal open onClose={onClose} size="lg" title="รายละเอียดการ์ด">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
        {/* ---------- คอลัมน์ซ้าย: เนื้อหาการ์ด ---------- */}
        <div className="flex flex-col gap-5">
          <form action={updateCardAction} className="flex flex-col gap-2">
            <input type="hidden" name="cardId" value={card.id} />
            <input type="hidden" name="priorityId" value={card.priorityId ?? ""} />
            <input
              type="text"
              name="title"
              defaultValue={card.title}
              required
              aria-label="ชื่อการ์ด"
              className={`${fieldClass} text-base font-semibold`}
            />
            <textarea
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
                id="dueDate"
                type="date"
                name="dueDate"
                defaultValue={card.dueDate ? card.dueDate.toISOString().slice(0, 10) : ""}
                className={`${fieldClass} w-auto py-1.5`}
              />
              <SubmitButton
                pendingLabel="กำลังบันทึก..."
                className="bg-accent text-accent-ink ml-auto rounded-lg px-3 py-1.5 text-sm font-medium hover:brightness-110"
              >
                บันทึก
              </SubmitButton>
            </div>
          </form>

          {/* ---------- checklist ---------- */}
          <section>
            <h3 className={sectionTitleClass}>
              เช็กลิสต์ {items.length > 0 && `(${doneItems}/${items.length})`}
            </h3>

            {card.checklists.length === 0 ? (
              <form action={createChecklistAction}>
                <input type="hidden" name="cardId" value={card.id} />
                <SubmitButton className="border-line text-muted hover:text-text rounded-lg border border-dashed px-3 py-1.5 text-xs">
                  + สร้างเช็กลิสต์
                </SubmitButton>
              </form>
            ) : (
              card.checklists.map((checklist) => (
                <div key={checklist.id} className="flex flex-col gap-1">
                  {checklist.items.map((item) => (
                    <div key={item.id} className="group flex items-center gap-2">
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
                      <span
                        className={`flex-1 text-sm ${
                          item.isCompleted ? "text-muted line-through" : "text-text"
                        }`}
                      >
                        {item.content}
                      </span>
                      <form action={deleteChecklistItemAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <SubmitButton
                          ariaLabel="ลบรายการ"
                          className="text-muted hover:text-danger focus-visible:opacity-100 opacity-0 group-hover:opacity-100"
                        >
                          <IconTrash size={14} />
                        </SubmitButton>
                      </form>
                    </div>
                  ))}
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
                </div>
              ))
            )}
          </section>

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
            <CardMoveButtons
              cardId={card.id}
              canMoveLeft={listIndex > 0}
              canMoveRight={listIndex < totalLists - 1}
              onAwarded={onAwarded}
            />
          </section>

          <section>
            <h3 className={sectionTitleClass}>ระดับความสำคัญ</h3>
            <div className="flex flex-wrap gap-1.5">
              {boardPriorities.length === 0 && (
                <p className="text-muted text-xs">ยังไม่มี priority ในบอร์ดนี้</p>
              )}
              {boardPriorities.map((priority) => {
                const isActive = card.priorityId === priority.id;
                return (
                  <form key={priority.id} action={setCardPriorityAction}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <input type="hidden" name="priorityId" value={priority.id} />
                    <SubmitButton
                      title={isActive ? "เอาออก" : `ตั้งเป็น ${priority.name}`}
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      // สีมาจากที่ผู้ใช้ตั้งเองใน DB จึงต้องใส่ผ่าน style
                    >
                      <span
                        style={
                          isActive
                            ? { backgroundColor: `${priority.color}22`, color: priority.color }
                            : { borderColor: priority.color, color: priority.color }
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                          isActive ? "" : "border border-dashed opacity-70"
                        }`}
                      >
                        {priority.name}
                      </span>
                    </SubmitButton>
                  </form>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className={sectionTitleClass}>ป้ายกำกับ</h3>
            <div className="flex flex-wrap gap-1.5">
              {boardLabels.length === 0 && (
                <p className="text-muted text-xs">ยังไม่มีป้ายกำกับ</p>
              )}
              {boardLabels.map((label) => {
                const isAssigned = card.labels.some((cardLabel) => cardLabel.labelId === label.id);
                return (
                  <form key={label.id} action={toggleCardLabelAction}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <input type="hidden" name="labelId" value={label.id} />
                    <SubmitButton title={label.name} ariaLabel={`สลับป้าย ${label.name}`}>
                      <span
                        style={{
                          backgroundColor: isAssigned ? label.color : "transparent",
                          borderColor: label.color,
                          color: isAssigned ? "#0b0c0e" : label.color,
                        }}
                        className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      >
                        {label.name}
                      </span>
                    </SubmitButton>
                  </form>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className={sectionTitleClass}>ผู้รับผิดชอบ</h3>
            <div className="flex flex-wrap gap-1.5">
              {boardMembers.map((member) => {
                const isAssigned = card.assignees.some(
                  (assignee) => assignee.userId === member.id
                );
                return (
                  <form key={member.id} action={toggleCardAssigneeAction}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <input type="hidden" name="userId" value={member.id} />
                    <SubmitButton
                      title={displayName(member)}
                      ariaLabel={`สลับผู้รับผิดชอบ ${displayName(member)}`}
                      className="block"
                    >
                      <Avatar user={member} size={26} muted={!isAssigned} />
                    </SubmitButton>
                  </form>
                );
              })}
            </div>
          </section>

          <form action={deleteCardAction} className="border-line border-t pt-4">
            <input type="hidden" name="cardId" value={card.id} />
            <ConfirmSubmitButton
              className="text-muted hover:text-danger flex items-center gap-1.5 text-xs"
              confirmClassName="bg-danger/15 text-danger rounded-lg px-2.5 py-1 text-xs font-medium"
            >
              <IconTrash size={14} /> ลบการ์ดนี้
            </ConfirmSubmitButton>
          </form>
        </aside>
      </div>
    </Modal>
  );
}
