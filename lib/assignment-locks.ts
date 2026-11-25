/*
 * แยกจาก lib/assignment-rules.ts เพราะ client component (หน้าบอร์ด) ใช้ด้วย
 * ไฟล์นั้น import zod — import จากที่นั่นจะลาก zod ทั้งก้อนเข้า bundle ของหน้าบอร์ด
 */

/*
 * นิยามการล็อก — ใช้ทั้งใน action (ด่านจริง) และ UI (ซ่อนปุ่ม)
 * ทุกตัวเช็ค card.assignmentId ด้วย: ลบงาน/ลบวิชาแล้ว DB ตั้งค่าเป็น null ให้เอง (SetNull)
 * การ์ดจะปลดล็อกทันทีแม้ fromAssignment ยังค้างเป็น true
 */
type CardRef = { assignmentId: string | null };

export function isAssignmentCard(card: CardRef): boolean {
  return card.assignmentId !== null;
}

export function isLockedChecklist(checklist: { fromAssignment: boolean }, card: CardRef): boolean {
  return checklist.fromAssignment && isAssignmentCard(card);
}

export function isLockedChecklistItem(item: { assignmentItemId: string | null }, card: CardRef): boolean {
  return item.assignmentItemId !== null && isAssignmentCard(card);
}
