import * as z from "zod";
import { ASSIGNMENT_ITEM_LIMIT } from "./assignment-rules";
import {
  DEFAULT_SPLITTER_SETTINGS,
  SPLITTER_DETAILS,
  SPLITTER_DETAIL_OPTIONS,
  SPLITTER_INSTRUCTIONS_MAX,
  SPLITTER_ITEMS_MAX,
  SPLITTER_ITEMS_MIN,
  type SplitterSettings,
} from "./task-splitter-options";

/*
 * กติกาของตัวแตกงานย่อยด้วย AI ที่ไม่แตะ DB และไม่เรียก AI (มี unit test)
 * ตัวเรียก AI จริงอยู่ที่ lib/task-splitter.ts — ไม่ว่าจะเปลี่ยนผู้ให้บริการไปเจ้าไหน prompt กับ parser ใช้ชุดนี้
 */

const itemCount = z
  .number({ error: "จำนวนงานย่อยต้องเป็นตัวเลข" })
  .int({ error: "จำนวนงานย่อยต้องเป็นจำนวนเต็ม" })
  .min(SPLITTER_ITEMS_MIN, { error: `จำนวนงานย่อยต้องอยู่ระหว่าง ${SPLITTER_ITEMS_MIN}–${SPLITTER_ITEMS_MAX}` })
  .max(SPLITTER_ITEMS_MAX, { error: `จำนวนงานย่อยต้องอยู่ระหว่าง ${SPLITTER_ITEMS_MIN}–${SPLITTER_ITEMS_MAX}` });
const detail = z.enum(SPLITTER_DETAILS, { error: "เลือกระดับความละเอียด" });
const instructions = z
  .string()
  .trim()
  .max(SPLITTER_INSTRUCTIONS_MAX, { error: `คำสั่งเพิ่มเติมยาวเกิน ${SPLITTER_INSTRUCTIONS_MAX} ตัวอักษร` });
const learnFromPast = z.boolean();

/** ตรวจค่าที่อาจารย์กรอก (บันทึก / ลองแตกดู) — ค่าผิดต้องบอก ไม่ใช่แก้ให้เงียบ ๆ */
export const splitterSettingsSchema = z
  .object({ minItems: itemCount, maxItems: itemCount, detail, instructions, learnFromPast })
  .refine((settings) => settings.minItems <= settings.maxItems, {
    error: "จำนวนต่ำสุดต้องไม่มากกว่าจำนวนสูงสุด",
    path: ["maxItems"],
  });

/**
 * อ่านค่าที่เก็บใน Course.splitterSettings — ช่องไหนเสียใช้ค่าเริ่มต้นเฉพาะช่องนั้น ไม่โยน error
 * (ค่าเก่าจากเวอร์ชันก่อน หรือช่องที่เพิ่มทีหลัง ต้องไม่ทำให้ปุ่ม AI พัง)
 */
export function readSplitterSettings(stored: unknown): SplitterSettings {
  const source = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const settings = z
    .object({
      minItems: itemCount.catch(DEFAULT_SPLITTER_SETTINGS.minItems),
      maxItems: itemCount.catch(DEFAULT_SPLITTER_SETTINGS.maxItems),
      detail: detail.catch(DEFAULT_SPLITTER_SETTINGS.detail),
      instructions: instructions.catch(DEFAULT_SPLITTER_SETTINGS.instructions),
      learnFromPast: learnFromPast.catch(DEFAULT_SPLITTER_SETTINGS.learnFromPast),
    })
    .parse(source);
  return settings.minItems > settings.maxItems ? { ...settings, maxItems: settings.minItems } : settings;
}

export type SplitTask = { title: string; description: string | null };
export type SplitExample = { title: string; description?: string | null; items: string[] };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** ใช้ตอนวิชายังไม่มีงานเก่า — ให้ AI เห็นรูปแบบคำตอบอย่างน้อยหนึ่งชุด (จงใจไม่ใช้โจทย์เครื่องคิดเลข จะได้ไม่ลอกตัวอย่าง) */
export const BUILT_IN_EXAMPLE: SplitExample = {
  title: "เว็บเพจแนะนำตัวเองด้วย HTML และ CSS",
  description: "หน้าเดียว มีรูป ประวัติย่อ และลิงก์ติดต่อ",
  items: [
    "ร่างโครงหน้าเว็บบนกระดาษว่ามีส่วนไหนบ้าง",
    "สร้างไฟล์ index.html พร้อมโครงสร้าง HTML พื้นฐาน",
    "ใส่เนื้อหา รูปโปรไฟล์ ประวัติย่อ และลิงก์ติดต่อ",
    "เขียน CSS จัดสี ตัวอักษร และระยะห่าง",
    "ทดสอบการแสดงผลบนมือถือและคอมพิวเตอร์",
    "อัปโหลดขึ้น GitHub Pages แล้วแนบลิงก์ส่งงาน",
  ],
};

const formatTask = (task: { title: string; description?: string | null }) =>
  `ชื่องาน: ${task.title}\nรายละเอียด: ${task.description?.trim() || "-"}`;

/**
 * prompt ของตัวแตกงาน — ส่วนที่ปรับจูนได้ทั้งหมดมาจาก settings และ examples
 * ตัวอย่างส่งเป็นคู่ user/assistant (few-shot) แทนการยัดไว้ใน system — โมเดลเลียนแบบรูปแบบคำตอบได้แม่นกว่า
 */
export function buildSplitMessages(
  task: SplitTask,
  settings: SplitterSettings,
  examples: SplitExample[]
): ChatMessage[] {
  const fromCourse = examples.length > 0;
  const rules = [
    "คุณเป็นผู้ช่วยอาจารย์มหาวิทยาลัย หน้าที่คือแตก \"งานที่มอบหมาย\" เป็นงานย่อยที่นักศึกษาทำตามได้ทีละขั้น จนได้ผลงานที่ส่งได้",
    "",
    "กติกา:",
    `- จำนวนงานย่อย ${settings.minItems}–${settings.maxItems} ข้อ`,
    `- ความละเอียด: ${SPLITTER_DETAIL_OPTIONS[settings.detail].prompt}`,
    "- เรียงตามลำดับที่ควรทำ",
    "- แต่ละข้อเป็นประโยคสั้น ขึ้นต้นด้วยคำกริยา และยาวไม่เกิน 120 ตัวอักษร",
    "- ไม่ต้องใส่เลขข้อหรือสัญลักษณ์นำหน้า",
    "- เขียนเป็นภาษาไทย ศัพท์เทคนิค ชื่อภาษาโปรแกรม และชื่อเครื่องมือใช้ภาษาอังกฤษได้",
    "- บอกว่าต้องทำอะไร ห้ามเฉลยคำตอบหรือเขียนโค้ดให้",
    '- ตอบเป็น JSON อย่างเดียวในรูปแบบ {"subtasks": ["...", "..."]} ห้ามมีข้อความอื่น',
  ];
  if (settings.instructions) {
    // ต้องบอกว่าชนะกติกาข้างบน — ไม่งั้นคำสั่งอย่าง "ขึ้นต้นทุกข้อด้วย ✅" แพ้กติกา "ไม่ใส่สัญลักษณ์นำหน้า" (เจอตอนทดสอบจริง)
    rules.push(
      "",
      "คำสั่งเพิ่มเติมจากอาจารย์ (สำคัญกว่ากติกาข้างบน ถ้าขัดกันให้ทำตามข้อนี้):",
      settings.instructions
    );
  }
  if (fromCourse) {
    rules.push(
      "",
      "ตัวอย่างต่อจากนี้คืองานที่อาจารย์วิชานี้เคยแตกเอง ให้เลียนแบบสไตล์และระดับความละเอียด แต่จำนวนข้อให้ทำตามกติกาข้างบน"
    );
  }

  const shots = (fromCourse ? examples : [BUILT_IN_EXAMPLE]).flatMap((example): ChatMessage[] => [
    { role: "user", content: formatTask(example) },
    { role: "assistant", content: JSON.stringify({ subtasks: example.items }) },
  ]);

  // ย้ำคำสั่งของอาจารย์ท้ายข้อความสุดท้ายด้วย — ตัวอย่าง (ที่ไม่มีรูปแบบตามคำสั่ง) อยู่ใกล้กว่า system
  // ถ้าไม่ย้ำ โมเดลเลียนแบบตัวอย่างแทนคำสั่ง (ทดสอบจริงกับ Typhoon: "ขึ้นต้นทุกข้อด้วย ✅" ถูกเมิน)
  const request = settings.instructions
    ? `${formatTask(task)}\n\nทำตามคำสั่งเพิ่มเติมจากอาจารย์ด้วย (สำคัญกว่าตัวอย่าง): ${settings.instructions}`
    : formatTask(task);

  return [{ role: "system", content: rules.join("\n") }, ...shots, { role: "user", content: request }];
}

/** ส่งต่อท้ายตอนลองใหม่ เมื่อคำตอบรอบแรกแกะไม่ได้ */
export const SPLIT_RETRY_REMINDER =
  'คำตอบก่อนหน้าอ่านไม่ได้ ตอบใหม่เป็น JSON อย่างเดียวในรูปแบบ {"subtasks": ["...", "..."]}';

const replySchema = z.object({ subtasks: z.array(z.string()) });

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** ตัวเลข / bullet / "ข้อ 1:" ที่โมเดลชอบใส่มาเองทั้งที่สั่งไม่ให้ใส่ */
// ต้องมีช่องว่างตามหลัง — ไม่งั้น "1.5 คะแนน" กลายเป็น "5 คะแนน"
const LEADING_MARKER = /^\s*(?:[-*•–]\s+|\d+\s*[.)]\s+|ข้อ(?:ที่)?\s*\d+\s*[.:)]?\s+)/u;

/**
 * แกะคำตอบของ AI เป็นรายการงานย่อย — แกะไม่ได้คืน null (ผู้เรียกลองใหม่ได้)
 * ทนต่อ code fence, ข้อความนำหน้า, <think> ของโมเดลแบบ reasoning และคำตอบที่เป็น array เปล่า ๆ
 */
export function parseSplitResponse(text: string, settings: Pick<SplitterSettings, "maxItems">): string[] | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?/gi, "");

  let candidate: unknown;
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) candidate = parseJson(cleaned.slice(objectStart, objectEnd + 1));
  if (candidate === undefined) {
    const arrayStart = cleaned.indexOf("[");
    const arrayEnd = cleaned.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      const array = parseJson(cleaned.slice(arrayStart, arrayEnd + 1));
      if (array !== undefined) candidate = { subtasks: array };
    }
  }

  const parsed = replySchema.safeParse(candidate);
  if (!parsed.success) return null;

  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of parsed.data.subtasks) {
    const content = raw.replace(LEADING_MARKER, "").trim().slice(0, 300);
    if (!content || seen.has(content)) continue;
    seen.add(content);
    items.push(content);
  }
  const limited = items.slice(0, Math.min(settings.maxItems, ASSIGNMENT_ITEM_LIMIT));
  return limited.length > 0 ? limited : null;
}

/**
 * เลือกงานเก่าของวิชามาเป็นตัวอย่าง — ใหม่สุดก่อน มีงานย่อยอย่างน้อย 2 ข้อ ไม่เกิน 3 งาน
 * ไม่รวมงานที่กำลังแก้ และงานชื่อเดียวกับงานที่จะแตก — ไม่งั้น AI ลอกรายการเดิมกลับมาทั้งชุด
 * (เจอตอนทดสอบจริง: "ลองแตกดู" ชื่อซ้ำกับร่างที่บันทึกไว้ ได้ผลเดิมเป๊ะ ปรับค่าเท่าไหร่ก็ไม่เปลี่ยน)
 */
export function pickExamples(
  assignments: { id: string; title: string; description: string | null; createdAt: Date; items: { content: string }[] }[],
  exclude: { id?: string; title?: string } = {}
): SplitExample[] {
  const sameTitle = (title: string) => Boolean(exclude.title) && title.trim() === exclude.title!.trim();
  return assignments
    .filter(
      (assignment) => assignment.id !== exclude.id && !sameTitle(assignment.title) && assignment.items.length >= 2
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
    .map((assignment) => ({
      title: assignment.title,
      description: assignment.description,
      items: assignment.items.map((item) => item.content),
    }));
}
