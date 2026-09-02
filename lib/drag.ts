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
