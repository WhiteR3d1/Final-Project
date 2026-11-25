import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUILT_IN_EXAMPLE,
  buildSplitMessages,
  parseSplitResponse,
  pickExamples,
  readSplitterSettings,
  splitterSettingsSchema,
} from "./task-splitter-rules";
import { DEFAULT_SPLITTER_SETTINGS } from "./task-splitter-options";

describe("readSplitterSettings", () => {
  it("null / ไม่ใช่ object → ค่าเริ่มต้นทั้งหมด", () => {
    assert.deepEqual(readSplitterSettings(null), DEFAULT_SPLITTER_SETTINGS);
    assert.deepEqual(readSplitterSettings("x"), DEFAULT_SPLITTER_SETTINGS);
    assert.deepEqual(readSplitterSettings([1, 2]), DEFAULT_SPLITTER_SETTINGS);
  });

  it("ช่องที่เสียใช้ค่าเริ่มต้นเฉพาะช่องนั้น ช่องที่ดีคงไว้", () => {
    const settings = readSplitterSettings({ minItems: 3, maxItems: 99, detail: "ultra", instructions: "ต้องมีเทสต์" });
    assert.equal(settings.minItems, 3);
    assert.equal(settings.maxItems, DEFAULT_SPLITTER_SETTINGS.maxItems);
    assert.equal(settings.detail, DEFAULT_SPLITTER_SETTINGS.detail);
    assert.equal(settings.instructions, "ต้องมีเทสต์");
    assert.equal(settings.learnFromPast, true);
  });

  it("min มากกว่า max ที่เก็บไว้ → ดัน max ขึ้นให้เท่า min", () => {
    const settings = readSplitterSettings({ minItems: 10, maxItems: 5 });
    assert.equal(settings.maxItems, 10);
  });
});

describe("splitterSettingsSchema", () => {
  const valid = { ...DEFAULT_SPLITTER_SETTINGS };

  it("ค่าเริ่มต้นผ่าน และ trim คำสั่งเพิ่มเติม", () => {
    const result = splitterSettingsSchema.parse({ ...valid, instructions: "  มีเทสต์  " });
    assert.equal(result.instructions, "มีเทสต์");
  });

  it("ค่าผิดต้องไม่ผ่าน (ไม่แก้ให้เงียบ ๆ)", () => {
    assert.equal(splitterSettingsSchema.safeParse({ ...valid, minItems: 1 }).success, false);
    assert.equal(splitterSettingsSchema.safeParse({ ...valid, maxItems: 16 }).success, false);
    assert.equal(splitterSettingsSchema.safeParse({ ...valid, minItems: 9, maxItems: 4 }).success, false);
    assert.equal(splitterSettingsSchema.safeParse({ ...valid, detail: "ultra" }).success, false);
    assert.equal(splitterSettingsSchema.safeParse({ ...valid, instructions: "ก".repeat(1001) }).success, false);
  });
});

describe("buildSplitMessages", () => {
  const task = { title: "เครื่องคิดเลขด้วย Python", description: "แบบ command line" };

  it("system มีจำนวนข้อ ระดับความละเอียด และรูปแบบ JSON", () => {
    const [system] = buildSplitMessages(task, { ...DEFAULT_SPLITTER_SETTINGS, minItems: 5, maxItems: 7, detail: "detailed" }, []);
    assert.equal(system.role, "system");
    assert.match(system.content, /5–7 ข้อ/);
    assert.match(system.content, /ผู้เริ่มต้น/);
    assert.match(system.content, /"subtasks"/);
  });

  it("คำสั่งเพิ่มเติมของอาจารย์อยู่ทั้งใน system และย้ำท้ายข้อความสุดท้าย เฉพาะตอนมีค่า", () => {
    const withExtra = buildSplitMessages(task, { ...DEFAULT_SPLITTER_SETTINGS, instructions: "ต้องมีข้อเขียนเทสต์" }, []);
    assert.match(withExtra[0].content, /คำสั่งเพิ่มเติมจากอาจารย์[\s\S]*ต้องมีข้อเขียนเทสต์/);
    assert.match(withExtra.at(-1)!.content, /เครื่องคิดเลข[\s\S]*ต้องมีข้อเขียนเทสต์/);
    const without = buildSplitMessages(task, DEFAULT_SPLITTER_SETTINGS, []);
    assert.doesNotMatch(without[0].content, /คำสั่งเพิ่มเติมจากอาจารย์/);
    assert.doesNotMatch(without.at(-1)!.content, /คำสั่งเพิ่มเติม/);
  });

  it("ตัวอย่างไม่ได้รับคำสั่งเพิ่มเติม (มีแค่ข้อความสุดท้าย)", () => {
    const messages = buildSplitMessages(task, { ...DEFAULT_SPLITTER_SETTINGS, instructions: "ต้องมีข้อเขียนเทสต์" }, []);
    assert.doesNotMatch(messages[1].content, /ต้องมีข้อเขียนเทสต์/);
  });

  it("งานเก่าของวิชาส่งเป็นคู่ user/assistant ตามลำดับ แล้วจบด้วยงานที่ต้องแตก", () => {
    const examples = [
      { title: "เกมทายตัวเลข", items: ["สุ่มตัวเลข", "รับคำตอบ"] },
      { title: "โปรแกรมตัดเกรด", items: ["รับคะแนน", "คำนวณเกรด"] },
    ];
    const messages = buildSplitMessages(task, DEFAULT_SPLITTER_SETTINGS, examples);
    assert.deepEqual(
      messages.map((message) => message.role),
      ["system", "user", "assistant", "user", "assistant", "user"]
    );
    assert.match(messages[1].content, /เกมทายตัวเลข/);
    assert.deepEqual(JSON.parse(messages[2].content), { subtasks: ["สุ่มตัวเลข", "รับคำตอบ"] });
    assert.match(messages[5].content, /เครื่องคิดเลขด้วย Python[\s\S]*command line/);
    assert.match(messages[0].content, /อาจารย์วิชานี้เคยแตกเอง/);
  });

  it("วิชาที่ยังไม่มีงานเก่าใช้ตัวอย่างในตัว และไม่อ้างว่าเป็นงานของอาจารย์", () => {
    const messages = buildSplitMessages(task, DEFAULT_SPLITTER_SETTINGS, []);
    assert.equal(messages.length, 4);
    assert.match(messages[1].content, new RegExp(BUILT_IN_EXAMPLE.title));
    assert.doesNotMatch(messages[0].content, /อาจารย์วิชานี้เคยแตกเอง/);
  });
});

describe("parseSplitResponse", () => {
  const settings = { maxItems: 8 };

  it("JSON ล้วน", () => {
    assert.deepEqual(parseSplitResponse('{"subtasks": ["รับตัวเลข", "คำนวณ"]}', settings), ["รับตัวเลข", "คำนวณ"]);
  });

  it("มี code fence และข้อความนำหน้า", () => {
    const text = 'นี่คืองานย่อยครับ\n```json\n{"subtasks": ["รับตัวเลข", "คำนวณ"]}\n```';
    assert.deepEqual(parseSplitResponse(text, settings), ["รับตัวเลข", "คำนวณ"]);
  });

  it("ตัด <think> ของโมเดลแบบ reasoning ออกก่อน", () => {
    const text = '<think>ลองคิดดู {ไม่ใช่ JSON}</think>{"subtasks": ["รับตัวเลข"]}';
    assert.deepEqual(parseSplitResponse(text, settings), ["รับตัวเลข"]);
  });

  it("รับ array เปล่า ๆ ได้", () => {
    assert.deepEqual(parseSplitResponse('["รับตัวเลข", "คำนวณ"]', settings), ["รับตัวเลข", "คำนวณ"]);
  });

  it("ตัดเลขข้อ/bullet ที่ใส่มาเอง ข้อว่าง และข้อซ้ำ", () => {
    const text = JSON.stringify({ subtasks: ["1. รับตัวเลข", "- คำนวณ", "ข้อ 3: ทดสอบ", "   ", "คำนวณ", "1.5 คะแนนพิเศษ"] });
    assert.deepEqual(parseSplitResponse(text, settings), ["รับตัวเลข", "คำนวณ", "ทดสอบ", "1.5 คะแนนพิเศษ"]);
  });

  it("เกิน maxItems ตัดทิ้ง", () => {
    const text = JSON.stringify({ subtasks: ["ก", "ข", "ค", "ง", "จ"] });
    assert.deepEqual(parseSplitResponse(text, { maxItems: 3 }), ["ก", "ข", "ค"]);
  });

  it("พัง / รูปแบบผิด / ว่าง → null", () => {
    assert.equal(parseSplitResponse("ขอโทษครับ ทำไม่ได้", settings), null);
    assert.equal(parseSplitResponse('{"subtasks": "รับตัวเลข"}', settings), null);
    assert.equal(parseSplitResponse('{"subtasks": []}', settings), null);
    assert.equal(parseSplitResponse('{"subtasks": ["รับ', settings), null);
  });
});

describe("pickExamples", () => {
  const assignment = (id: string, day: number, items: number) => ({
    id,
    title: `งาน ${id}`,
    description: null,
    createdAt: new Date(2026, 10, day),
    items: Array.from({ length: items }, (_, index) => ({ content: `ข้อ ${index}` })),
  });

  it("ใหม่สุดก่อน ไม่เกิน 3 งาน", () => {
    const picked = pickExamples([assignment("a", 1, 3), assignment("b", 4, 3), assignment("c", 2, 3), assignment("d", 3, 3)]);
    assert.deepEqual(picked.map((example) => example.title), ["งาน b", "งาน d", "งาน c"]);
  });

  it("ข้ามงานที่งานย่อยน้อยกว่า 2 ข้อ และงานที่กำลังแก้", () => {
    const picked = pickExamples([assignment("a", 1, 1), assignment("b", 2, 4), assignment("c", 3, 4)], { id: "c" });
    assert.deepEqual(picked.map((example) => example.title), ["งาน b"]);
    assert.equal(picked[0].items.length, 4);
  });

  it("ข้ามงานชื่อเดียวกับงานที่จะแตก (กัน AI ลอกรายการเดิม)", () => {
    const picked = pickExamples([assignment("a", 1, 3), assignment("b", 2, 3)], { title: "  งาน b " });
    assert.deepEqual(picked.map((example) => example.title), ["งาน a"]);
  });
});
