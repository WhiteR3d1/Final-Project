/**
 * ตรรกะตัดสินใจของ drag & drop บนบอร์ด — คณิตศาสตร์ล้วน ไม่แตะ DOM หรือ @dnd-kit
 * แยกออกมาเพราะตัวลากจริงทดสอบอัตโนมัติไม่ได้ แต่ "จะวางที่ไหน" ทดสอบได้
 *
 * ประกาศ type แบบ structural ไม่ import จาก board/[id]/types.ts
 * เพื่อไม่ให้ lib/ ผูกกับโฟลเดอร์ route (ListWithCards เข้ากันได้เองอยู่แล้ว)
 */

type DraggableList = { id: string; cards: { id: string }[] };

/**
 * id ที่ปล่อยทับอาจเป็น "การ์ด" ไม่ใช่ "คอลัมน์" เพราะ closestCorners มักเลือกการ์ด
 * ในคอลัมน์ปลายทางเป็น over — แปลงกลับเป็นคอลัมน์ที่การ์ดนั้นอยู่
 *
 * คืน null เมื่อไม่ต้องย้าย (ปล่อยทับตัวเอง หรือ id ที่ไม่รู้จัก)
 */
export function resolveListDropTarget(
  lists: DraggableList[],
  activeId: string,
  overId: string
): string | null {
  const target =
    lists.find((list) => list.id === overId) ??
    lists.find((list) => list.cards.some((card) => card.id === overId));

  if (!target || target.id === activeId) return null;
  return target.id;
}

/**
 * ตำแหน่งกึ่งกลางระหว่างเพื่อนบ้าน — position เป็น Float จึงแทรกกลางได้
 * โดยไม่ต้องเขียนลำดับใหม่ทั้งคอลัมน์
 */
export function positionBetween(before?: number, after?: number): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (after !== undefined) return after - 1;
  if (before !== undefined) return before + 1;
  return 1;
}

type OrderedList = { id: string; position: number; isDoneList: boolean };

/**
 * ชื่อที่ถือว่าเป็นคอลัมน์ "เสร็จสิ้น" — บอร์ดที่ยังไม่มีคอลัมน์เสร็จสิ้นแล้วตั้งชื่อคอลัมน์แบบนี้
 * จะถูกตั้งเป็นคอลัมน์เสร็จสิ้นให้อัตโนมัติ (ตามคำแนะนำของอาจารย์)
 * เทียบทั้งชื่อ ไม่ใช่ includes — ไม่งั้น "Not done" ก็จะกลายเป็นคอลัมน์เสร็จสิ้นไปด้วย
 * **ต้องตรงกับรายชื่อใน migration `review_workflow`**
 */
export const DONE_LIST_NAMES = [
  "done",
  "finish",
  "finished",
  "complete",
  "completed",
  "เสร็จ",
  "เสร็จสิ้น",
  "เสร็จแล้ว",
];

export function isDoneListName(name: string): boolean {
  return DONE_LIST_NAMES.includes(name.trim().toLowerCase());
}

/**
 * ตำแหน่งของคอลัมน์ใหม่ที่แทรกข้างคอลัมน์ anchor (lists ต้องเรียงตาม position มาแล้ว)
 * ไม่มี anchor = ต่อท้าย และไม่ว่าจะขอแทรกตรงไหน ก็ห้ามเลยคอลัมน์เสร็จสิ้นซึ่งต้องอยู่ขวาสุด
 */
export function insertListPosition(
  lists: OrderedList[],
  anchorId?: string | null,
  side: "before" | "after" = "after"
): number {
  const anchorIndex = anchorId ? lists.findIndex((list) => list.id === anchorId) : -1;
  let index =
    anchorIndex === -1 ? lists.length : side === "before" ? anchorIndex : anchorIndex + 1;

  const doneIndex = lists.findIndex((list) => list.isDoneList);
  if (doneIndex !== -1 && index > doneIndex) index = doneIndex;

  return positionBetween(lists[index - 1]?.position, lists[index]?.position);
}

/**
 * index ปลายทางตอนลากคอลัมน์ — ห้ามลากไปหลังคอลัมน์เสร็จสิ้น และคอลัมน์เสร็จสิ้นเองลากไม่ได้
 * ใช้กับ arrayMove: ถ้าลากจากซ้ายไปทับคอลัมน์เสร็จสิ้น ต้องหยุดที่ช่องก่อนหน้ามัน
 */
export function clampBeforeDone(
  lists: { isDoneList: boolean }[],
  oldIndex: number,
  newIndex: number
): number {
  const doneIndex = lists.findIndex((list) => list.isDoneList);
  if (doneIndex === -1) return newIndex;
  if (oldIndex === doneIndex) return oldIndex;

  const maxIndex = oldIndex < doneIndex ? doneIndex - 1 : doneIndex;
  return Math.min(newIndex, maxIndex);
}
