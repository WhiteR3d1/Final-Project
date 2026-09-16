"use client";

import type { Label, Priority, User } from "@/app/generated/prisma/client";
import { Avatar, AvatarStack, displayName } from "@/app/components/ui/avatar";
import { SubmitButton } from "@/app/components/ui/buttons";
import { IconCheck } from "@/app/components/ui/icons";
import { MenuEmpty, SelectMenu, menuItemClass } from "@/app/components/ui/select-menu";
import {
  setCardPriorityAction,
  toggleCardAssigneeAction,
  toggleCardLabelAction,
} from "./actions";

/**
 * สามช่องนี้ (ระดับความสำคัญ / ป้ายกำกับ / ผู้รับผิดชอบ) เคยวางตัวเลือกทั้งบอร์ดเรียงไว้ตลอดเวลา
 * พอบอร์ดมีสมาชิกหรือป้ายเยอะ แถวจะยาวจนอ่านยาก และอวาตาร์ที่เหลือแค่ตัวอักษรแรก
 * ก็ซ้ำกันจนแยกไม่ออกว่าใครเป็นใคร จึงยุบเป็น dropdown ที่กางออกมาแล้วเห็นชื่อเต็ม
 */

const chipClass = "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium";
const placeholderClass = "text-muted truncate";

/** สีของ label/priority ผู้ใช้ตั้งเองใน DB จึงต้องใส่ผ่าน style ไม่ใช่ utility */
function priorityChip(priority: Priority) {
  return (
    <span
      key={priority.id}
      style={{ backgroundColor: `${priority.color}22`, color: priority.color }}
      className={chipClass}
    >
      {priority.name}
    </span>
  );
}

function labelChip(label: Label) {
  return (
    <span
      key={label.id}
      style={{ backgroundColor: label.color, color: "#0b0c0e" }}
      className={chipClass}
    >
      {label.name}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{ backgroundColor: color }}
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      aria-hidden="true"
    />
  );
}

function Selected() {
  return <IconCheck size={14} className="text-accent ml-auto shrink-0" />;
}

/* ------------------------------ ระดับความสำคัญ ------------------------------ */

export function CardPrioritySelect({
  cardId,
  priorities,
  selectedId,
  canEdit,
}: {
  cardId: string;
  priorities: Priority[];
  selectedId: string | null;
  canEdit: boolean;
}) {
  const selected = priorities.find((priority) => priority.id === selectedId) ?? null;

  if (!canEdit) {
    return selected ? priorityChip(selected) : <p className="text-muted text-xs">ไม่ได้กำหนดระดับ</p>;
  }

  return (
    <SelectMenu
      menuLabel="เลือกระดับความสำคัญ"
      trigger={selected ? priorityChip(selected) : <span className={placeholderClass}>ไม่กำหนด</span>}
    >
      {(close) => (
        <>
          {priorities.length === 0 && <MenuEmpty>บอร์ดนี้ยังไม่มีระดับความสำคัญ</MenuEmpty>}

          {/* เลือกได้ค่าเดียว จึงต้องมีแถวล้างค่า — ส่ง priorityId ว่างไปให้ action เคลียร์ */}
          <form action={setCardPriorityAction} onSubmit={close}>
            <input type="hidden" name="cardId" value={cardId} />
            <input type="hidden" name="priorityId" value="" />
            <SubmitButton
              ariaLabel="ไม่กำหนดระดับความสำคัญ"
              className={`${menuItemClass} ${selected ? "text-muted" : "text-text"}`}
            >
              <span className="truncate">ไม่กำหนด</span>
              {!selected && <Selected />}
            </SubmitButton>
          </form>

          {priorities.map((priority) => (
            <form key={priority.id} action={setCardPriorityAction} onSubmit={close}>
              <input type="hidden" name="cardId" value={cardId} />
              <input type="hidden" name="priorityId" value={priority.id} />
              <SubmitButton
                ariaLabel={`ตั้งระดับความสำคัญเป็น ${priority.name}`}
                className={`${menuItemClass} text-text`}
              >
                <Dot color={priority.color} />
                <span className="truncate">{priority.name}</span>
                {priority.id === selectedId && <Selected />}
              </SubmitButton>
            </form>
          ))}
        </>
      )}
    </SelectMenu>
  );
}

/* -------------------------------- ป้ายกำกับ -------------------------------- */

export function CardLabelSelect({
  cardId,
  labels,
  selectedIds,
  canEdit,
}: {
  cardId: string;
  labels: Label[];
  selectedIds: string[];
  canEdit: boolean;
}) {
  const selected = labels.filter((label) => selectedIds.includes(label.id));

  if (!canEdit) {
    return selected.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">{selected.map((label) => labelChip(label))}</div>
    ) : (
      <p className="text-muted text-xs">ยังไม่มีป้ายกำกับ</p>
    );
  }

  return (
    <SelectMenu
      menuLabel="เลือกป้ายกำกับ"
      trigger={
        selected.length === 0 ? (
          <span className={placeholderClass}>เลือกป้ายกำกับ</span>
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            {labelChip(selected[0])}
            {selected.length > 1 && (
              <span className="text-muted shrink-0 text-[11px]">+{selected.length - 1}</span>
            )}
          </span>
        )
      }
    >
      {() => (
        <>
          {labels.length === 0 && <MenuEmpty>บอร์ดนี้ยังไม่มีป้ายกำกับ</MenuEmpty>}

          {labels.map((label) => {
            const isSelected = selectedIds.includes(label.id);

            return (
              <form key={label.id} action={toggleCardLabelAction}>
                <input type="hidden" name="cardId" value={cardId} />
                <input type="hidden" name="labelId" value={label.id} />
                <SubmitButton
                  ariaLabel={`สลับป้าย ${label.name}`}
                  className={`${menuItemClass} ${isSelected ? "text-text" : "text-muted"}`}
                >
                  <Dot color={label.color} />
                  <span className="truncate">{label.name}</span>
                  {isSelected && <Selected />}
                </SubmitButton>
              </form>
            );
          })}
        </>
      )}
    </SelectMenu>
  );
}

/* ------------------------------- ผู้รับผิดชอบ ------------------------------- */

export function CardAssigneeSelect({
  cardId,
  members,
  selectedIds,
  canEdit,
}: {
  cardId: string;
  members: User[];
  selectedIds: string[];
  canEdit: boolean;
}) {
  const selected = members.filter((member) => selectedIds.includes(member.id));

  if (!canEdit) {
    return selected.length > 0 ? (
      <div className="flex flex-col gap-1.5">
        {selected.map((member) => (
          <span key={member.id} className="flex items-center gap-2 text-xs">
            <Avatar user={member} size={22} />
            <span className="text-text truncate">{displayName(member)}</span>
          </span>
        ))}
      </div>
    ) : (
      <p className="text-muted text-xs">ยังไม่มีผู้รับผิดชอบ</p>
    );
  }

  return (
    <SelectMenu
      menuLabel="เลือกผู้รับผิดชอบ"
      trigger={
        selected.length === 0 ? (
          <span className={placeholderClass}>เลือกผู้รับผิดชอบ</span>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5">
            <AvatarStack users={selected} size={20} max={3} />
            <span className="text-text truncate">
              {selected.length === 1 ? displayName(selected[0]) : `${selected.length} คน`}
            </span>
          </span>
        )
      }
    >
      {() => (
        <>
          {members.length === 0 && <MenuEmpty>บอร์ดนี้ยังไม่มีสมาชิก</MenuEmpty>}

          {members.map((member) => {
            const isSelected = selectedIds.includes(member.id);

            return (
              <form key={member.id} action={toggleCardAssigneeAction}>
                <input type="hidden" name="cardId" value={cardId} />
                <input type="hidden" name="userId" value={member.id} />
                <SubmitButton
                  ariaLabel={`สลับผู้รับผิดชอบ ${displayName(member)}`}
                  className={`${menuItemClass} ${isSelected ? "text-text" : "text-muted"}`}
                >
                  <Avatar user={member} size={22} muted={!isSelected} />
                  {/* ชื่อคนอาจขึ้นต้นด้วยตัวอักษรเดียวกัน อวาตาร์จึงซ้ำกันได้ ต้องมีอีเมลกำกับ */}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{displayName(member)}</span>
                    {member.name && (
                      <span className="text-muted block truncate text-[10px]">{member.email}</span>
                    )}
                  </span>
                  {isSelected && <Selected />}
                </SubmitButton>
              </form>
            );
          })}
        </>
      )}
    </SelectMenu>
  );
}
