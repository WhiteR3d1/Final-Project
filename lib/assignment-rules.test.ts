import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSIGNMENT_ITEM_LIMIT,
  assignmentInputSchema,
  canDeleteAssignment,
  diffAssignmentItems,
  pickAssignmentList,
  summarizeAssignmentCopies,
} from "./assignment-rules";
import { isAssignmentCard, isLockedChecklist, isLockedChecklistItem } from "./assignment-locks";

describe("assignmentInputSchema", () => {
  const base = { title: "เครื่องคิดเลข Python", description: "", dueDate: "", items: [] };

  it("trim ชื่อ และคำอธิบาย/กำหนดส่งที่ว่างกลายเป็น null", () => {
    const result = assignmentInputSchema.parse({ ...base, title: "  เครื่องคิดเลข  ", description: "   " });
    assert.equal(result.title, "เครื่องคิดเลข");
    assert.equal(result.description, null);
    assert.equal(result.dueDate, null);
  });

  it("กำหนดส่งเก็บเป็นเที่ยงคืน UTC เหมือน Card.dueDate", () => {
    const result = assignmentInputSchema.parse({ ...base, dueDate: "2026-12-05" });
    assert.equal(result.dueDate?.toISOString(), "2026-12-05T00:00:00.000Z");
  });

  it("ปฏิเสธชื่อว่างและวันที่ที่ไม่ใช่ YYYY-MM-DD", () => {
    assert.equal(assignmentInputSchema.safeParse({ ...base, title: "   " }).success, false);
    assert.equal(assignmentInputSchema.safeParse({ ...base, dueDate: "5/12/2026" }).success, false);
    assert.equal(assignmentInputSchema.safeParse({ ...base, dueDate: "2026-13-40" }).success, false);
  });

  it("ตัดงานย่อยที่ว่างทิ้ง และ trim ข้อที่เหลือ", () => {
    const result = assignmentInputSchema.parse({
      ...base,
      items: [{ content: " รับตัวเลข " }, { content: "   " }, { id: "a", content: "หารศูนย์" }],
    });
    assert.deepEqual(result.items, [{ content: "รับตัวเลข" }, { id: "a", content: "หารศูนย์" }]);
  });

  it(`งานย่อยเกิน ${ASSIGNMENT_ITEM_LIMIT} ข้อไม่ผ่าน`, () => {
    const items = Array.from({ length: ASSIGNMENT_ITEM_LIMIT + 1 }, (_, index) => ({ content: `ข้อ ${index}` }));
    assert.equal(assignmentInputSchema.safeParse({ ...base, items }).success, false);
  });
});

describe("pickAssignmentList", () => {
  const list = (id: string, position: number, flags: { done?: boolean; review?: boolean } = {}) => ({
    id,
    position,
    isDoneList: flags.done ?? false,
    isReviewList: flags.review ?? false,
  });

  it("เลือกคอลัมน์ซ้ายสุดตาม position ไม่ใช่ตามลำดับใน array", () => {
    assert.equal(pickAssignmentList([list("b", 2), list("a", 1), list("c", 3)])?.id, "a");
  });

  it("ข้ามคอลัมน์ตรวจและคอลัมน์เสร็จสิ้น", () => {
    const lists = [list("review", 1, { review: true }), list("done", 2, { done: true }), list("todo", 3)];
    assert.equal(pickAssignmentList(lists)?.id, "todo");
  });

  it("มีแต่คอลัมน์ตรวจ/เสร็จสิ้น หรือไม่มีคอลัมน์เลย → null", () => {
    assert.equal(pickAssignmentList([list("r", 1, { review: true }), list("d", 2, { done: true })]), null);
    assert.equal(pickAssignmentList([]), null);
  });
});

describe("diffAssignmentItems", () => {
  const existing = [
    { id: "i1", content: "รับตัวเลข", position: 1 },
    { id: "i2", content: "เลือกเครื่องหมาย", position: 2 },
    { id: "i3", content: "หารศูนย์", position: 3 },
  ];

  it("ไม่เปลี่ยนอะไร = ไม่มีงานให้ทำ", () => {
    const diff = diffAssignmentItems(existing, existing.map(({ id, content }) => ({ id, content })));
    assert.deepEqual(diff, { create: [], update: [], remove: [] });
  });

  it("แก้คำ ลบข้อ เพิ่มข้อ ในครั้งเดียว", () => {
    const diff = diffAssignmentItems(existing, [
      { id: "i1", content: "รับตัวเลข 2 ตัว" },
      { id: "i3", content: "หารศูนย์" },
      { content: "วนถามจนกว่าจะออก" },
    ]);
    assert.deepEqual(diff.update, [
      { id: "i1", content: "รับตัวเลข 2 ตัว", position: 1 },
      { id: "i3", content: "หารศูนย์", position: 2 },
    ]);
    assert.deepEqual(diff.create, [{ content: "วนถามจนกว่าจะออก", position: 3 }]);
    assert.deepEqual(diff.remove, ["i2"]);
  });

  it("สลับลำดับอย่างเดียว = update position", () => {
    const diff = diffAssignmentItems(existing.slice(0, 2), [
      { id: "i2", content: "เลือกเครื่องหมาย" },
      { id: "i1", content: "รับตัวเลข" },
    ]);
    assert.deepEqual(diff.update, [
      { id: "i2", content: "เลือกเครื่องหมาย", position: 1 },
      { id: "i1", content: "รับตัวเลข", position: 2 },
    ]);
    assert.deepEqual(diff.create, []);
    assert.deepEqual(diff.remove, []);
  });

  it("id ที่ไม่ใช่ของงานนี้ หรือส่งซ้ำ ถือเป็นข้อใหม่", () => {
    const diff = diffAssignmentItems(existing.slice(0, 1), [
      { id: "i1", content: "รับตัวเลข" },
      { id: "i1", content: "ข้อซ้ำ" },
      { id: "other-assignment-item", content: "ข้อปลอม" },
    ]);
    assert.deepEqual(diff.update, []);
    assert.deepEqual(diff.create, [
      { content: "ข้อซ้ำ", position: 2 },
      { content: "ข้อปลอม", position: 3 },
    ]);
    assert.deepEqual(diff.remove, []);
  });
});

describe("summarizeAssignmentCopies", () => {
  const copy = (
    overrides: Partial<{ inReviewList: boolean; reviewStatus: "APPROVED" | "CHANGES_REQUESTED" | null }>,
    done: number,
    total: number
  ) => ({
    inReviewList: false,
    reviewStatus: null,
    submittedAt: null,
    ...overrides,
    items: Array.from({ length: total }, (_, index) => ({ isCompleted: index < done })),
  });

  it("นับสถานะแบบเดียวกับ CSV: อยู่คอลัมน์ตรวจ = รอตรวจ แม้เคยถูกส่งกลับ", () => {
    const summary = summarizeAssignmentCopies([
      copy({ inReviewList: true, reviewStatus: "CHANGES_REQUESTED" }, 4, 4),
      copy({ reviewStatus: "APPROVED" }, 4, 4),
      copy({ reviewStatus: "CHANGES_REQUESTED" }, 2, 4),
      copy({}, 0, 4),
    ]);
    assert.equal(summary.boards, 4);
    assert.equal(summary.pending, 1);
    assert.equal(summary.approved, 1);
    assert.equal(summary.changesRequested, 1);
    assert.equal(summary.submitted, 3);
    // (100 + 100 + 50 + 0) / 4
    assert.equal(summary.progress, 63);
  });

  it("งานที่ไม่มีงานย่อย → progress เป็น null ไม่ใช่ 0%", () => {
    assert.equal(summarizeAssignmentCopies([copy({}, 0, 0)]).progress, null);
    assert.equal(summarizeAssignmentCopies([]).progress, null);
  });
});

describe("canDeleteAssignment", () => {
  const published = { publishedAt: new Date("2026-11-20") };

  it("ร่างลบได้เสมอ", () => {
    assert.equal(canDeleteAssignment({ publishedAt: null }, []), true);
  });

  const untouched = { submittedAt: null, completedAt: null, reviewStatus: null };

  it("แจกแล้วแต่ยังไม่มีใครส่ง → ลบได้", () => {
    assert.equal(canDeleteAssignment(published, [untouched, untouched]), true);
  });

  it("มีบอร์ดเคยส่งตรวจ มีผลตรวจ หรือเคยเสร็จ → ลบไม่ได้", () => {
    assert.equal(canDeleteAssignment(published, [untouched, { ...untouched, submittedAt: new Date() }]), false);
    assert.equal(canDeleteAssignment(published, [{ ...untouched, reviewStatus: "APPROVED" }]), false);
    assert.equal(canDeleteAssignment(published, [{ ...untouched, completedAt: new Date() }]), false);
  });
});

describe("การล็อกการ์ดงานจากอาจารย์", () => {
  const linked = { assignmentId: "a1" };
  const detached = { assignmentId: null };

  it("ล็อกเฉพาะตอนการ์ดยังผูกกับงาน", () => {
    assert.equal(isAssignmentCard(linked), true);
    assert.equal(isAssignmentCard(detached), false);
  });

  it("เช็กลิสต์ของอาจารย์ปลดล็อกเมื่อการ์ดหลุดจากงาน (ลบวิชา → SetNull)", () => {
    assert.equal(isLockedChecklist({ fromAssignment: true }, linked), true);
    assert.equal(isLockedChecklist({ fromAssignment: true }, detached), false);
    assert.equal(isLockedChecklist({ fromAssignment: false }, linked), false);
  });

  it("ข้อที่นักศึกษาเพิ่มเองไม่ล็อก แม้อยู่ในการ์ดงาน", () => {
    assert.equal(isLockedChecklistItem({ assignmentItemId: "x" }, linked), true);
    assert.equal(isLockedChecklistItem({ assignmentItemId: null }, linked), false);
    assert.equal(isLockedChecklistItem({ assignmentItemId: "x" }, detached), false);
  });
});
