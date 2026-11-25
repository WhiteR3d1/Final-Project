import * as z from "zod";

/**
 * กติกาของ "งานที่มอบหมาย" ที่ไม่แตะ DB (มี unit test) — ตัวที่แตะ DB อยู่ที่ lib/assignments.ts
 * schema อยู่ที่นี่เพราะไฟล์ "use server" export ได้แค่ async function แชร์ให้ dialog ฝั่ง client ไม่ได้
 */

export const ASSIGNMENT_CHECKLIST_TITLE = "งานย่อยจากอาจารย์";
export const ASSIGNMENT_ITEM_LIMIT = 30;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const assignmentInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "กรอกชื่องาน" })
    .max(200, { error: "ชื่องานยาวเกิน 200 ตัวอักษร" }),
  description: z
    .string()
    .trim()
    .max(2000, { error: "คำอธิบายยาวเกิน 2000 ตัวอักษร" })
    .transform((value) => value || null),
  // มาจาก <input type="date"> → เก็บเป็นเที่ยงคืน UTC เหมือน Card.dueDate (ดู lib/due.ts)
  dueDate: z
    .string()
    .refine((value) => value === "" || (DATE_KEY.test(value) && !Number.isNaN(Date.parse(value))), {
      error: "วันกำหนดส่งไม่ถูกต้อง",
    })
    .transform((value) => (value ? new Date(value) : null)),
  items: z
    .array(
      z.object({
        id: z.string().max(64).optional(),
        content: z.string().trim().max(300, { error: "งานย่อยแต่ละข้อยาวเกิน 300 ตัวอักษร" }),
      })
    )
    .max(ASSIGNMENT_ITEM_LIMIT, { error: `งานย่อยได้ไม่เกิน ${ASSIGNMENT_ITEM_LIMIT} ข้อ` })
    // แถวว่างที่กดเพิ่มไว้แล้วไม่ได้กรอก ตัดทิ้งเงียบ ๆ ดีกว่าบังคับให้ไปลบเอง
    .transform((items) => items.filter((item) => item.content)),
});

export type AssignmentInput = z.output<typeof assignmentInputSchema>;

type OrderedList = { position: number; isDoneList: boolean; isReviewList: boolean };

/** คอลัมน์ที่การ์ดงานจะไปลง = ซ้ายสุดที่ไม่ใช่คอลัมน์ตรวจ/เสร็จสิ้น (ไม่มีเลย = ผู้เรียกต้องสร้างให้) */
export function pickAssignmentList<T extends OrderedList>(lists: T[]): T | null {
  return (
    [...lists]
      .sort((a, b) => a.position - b.position)
      .find((list) => !list.isDoneList && !list.isReviewList) ?? null
  );
}

type ExistingItem = { id: string; content: string; position: number };
type IncomingItem = { id?: string; content: string };

/**
 * เทียบงานย่อยเดิมกับที่อาจารย์ส่งมา — ลำดับที่ส่งมาคือ position ใหม่ (1, 2, 3, …)
 * id ที่ไม่ใช่ของงานนี้ (หรือส่งซ้ำ) ถือเป็นข้อใหม่ ห้ามเชื่อ id จาก client
 * ข้อที่ไม่เปลี่ยนเลยไม่อยู่ใน update — จะได้ไม่ยิง query ไปทุกบอร์ดเปล่า ๆ
 */
export function diffAssignmentItems(existing: ExistingItem[], incoming: IncomingItem[]) {
  const known = new Map(existing.map((item) => [item.id, item]));
  const kept = new Set<string>();
  const create: { content: string; position: number }[] = [];
  const update: { id: string; content: string; position: number }[] = [];

  incoming.forEach((item, index) => {
    const position = index + 1;
    const current = item.id ? known.get(item.id) : undefined;
    if (!current || kept.has(current.id)) {
      create.push({ content: item.content, position });
      return;
    }
    kept.add(current.id);
    if (current.content !== item.content || current.position !== position) {
      update.push({ id: current.id, content: item.content, position });
    }
  });

  const remove = existing.filter((item) => !kept.has(item.id)).map((item) => item.id);
  return { create, update, remove };
}

export type AssignmentCopy = {
  inReviewList: boolean;
  reviewStatus: "APPROVED" | "CHANGES_REQUESTED" | null;
  submittedAt: Date | null;
  /** เฉพาะงานย่อยของอาจารย์ — เช็กลิสต์ที่นักศึกษาเพิ่มเองไม่นับ */
  items: { isCompleted: boolean }[];
};

/**
 * ตัวเลขสรุปของงานหนึ่งงานทั้งวิชา
 * อยู่คอลัมน์ตรวจ = รอตรวจ แม้จะเคยมีผลตรวจ (ส่งกลับแก้แล้วส่งใหม่) — นิยามเดียวกับ CSV และหน้า /review
 */
export function summarizeAssignmentCopies(copies: AssignmentCopy[]) {
  let pending = 0;
  let approved = 0;
  let changesRequested = 0;
  const ratios: number[] = [];

  for (const copy of copies) {
    if (copy.inReviewList) pending += 1;
    else if (copy.reviewStatus === "APPROVED") approved += 1;
    else if (copy.reviewStatus === "CHANGES_REQUESTED") changesRequested += 1;

    if (copy.items.length > 0) {
      ratios.push(copy.items.filter((item) => item.isCompleted).length / copy.items.length);
    }
  }

  return {
    boards: copies.length,
    submitted: pending + approved + changesRequested,
    pending,
    approved,
    changesRequested,
    /** null = งานนี้ไม่มีงานย่อย */
    progress: ratios.length ? Math.round((ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length) * 100) : null,
  };
}

/**
 * ลบงานได้เมื่อยังเป็นร่าง หรือยังไม่มีบอร์ดไหนเคยส่งตรวจ — ไม่งั้นงานและคะแนนของนักศึกษาหาย
 * completedAt นับด้วย: บอร์ดที่ปิดคอลัมน์ตรวจทิ้งแล้วลากเข้าเสร็จสิ้นเอง ก็ถือว่าส่งงานไปแล้ว
 */
export function canDeleteAssignment(
  assignment: { publishedAt: Date | null },
  copies: { submittedAt: Date | null; completedAt: Date | null; reviewStatus: string | null }[]
): boolean {
  if (!assignment.publishedAt) return true;
  return copies.every((copy) => !copy.submittedAt && !copy.completedAt && !copy.reviewStatus);
}
