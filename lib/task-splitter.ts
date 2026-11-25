import "server-only";
import {
  SPLIT_RETRY_REMINDER,
  buildSplitMessages,
  parseSplitResponse,
  type ChatMessage,
  type SplitExample,
  type SplitTask,
} from "./task-splitter-rules";
import type { SplitterSettings } from "./task-splitter-options";

/*
 * ตัวเรียก AI ของตัวแตกงานย่อย — **ส่วนที่ผูกกับผู้ให้บริการอยู่ในไฟล์นี้ที่เดียว**
 * ตอนนี้ใช้ Typhoon (โมเดลภาษาไทย open source ของ SCB 10X) ผ่าน API ของ opentyphoon.ai ซึ่งรูปแบบเดียวกับ OpenAI
 * จะเปลี่ยนไป Ollama / Claude / เจ้าอื่น แก้แค่ callModel() — prompt กับ parser อยู่ที่ task-splitter-rules.ts
 *
 * ข้อตกลงของ Typhoon API: ข้อความที่ส่งไปอาจถูกใช้พัฒนาโมเดล **ห้ามมีข้อมูลส่วนบุคคล**
 * — ส่งได้แค่ชื่องาน/โจทย์/งานย่อยของอาจารย์ ห้ามส่งชื่อหรืออีเมลนักศึกษา
 */

const ENDPOINT = "https://api.opentyphoon.ai/v1/chat/completions";
export const DEFAULT_TYPHOON_MODEL = "typhoon-v2.5-30b-a3b-instruct";
// ค่าเริ่มต้นของ Typhoon คือ 150 token ซึ่งตัดคำตอบภาษาไทยกลางคัน — ต้องตั้งเองเสมอ
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 30_000;

const NOT_CONFIGURED = "ยังไม่ได้ตั้งค่า TYPHOON_API_KEY — ใส่ key ของ Typhoon ใน .env (และใน Vercel) ก่อน";
const UNAVAILABLE = "AI ไม่ตอบ ลองใหม่อีกครั้ง";

export type SplitResult = { items: string[] } | { error: string };

/** บอกหน้าจอว่าใช้ปุ่ม AI ได้หรือยัง — ส่งไป client ได้แค่ boolean นี้ ห้ามส่ง key */
export function isSplitterConfigured(): boolean {
  return Boolean(process.env.TYPHOON_API_KEY);
}

/** แตกงานเป็นงานย่อย — แกะคำตอบไม่ได้ลองใหม่ 1 ครั้ง (ส่งคำตอบเดิมกลับไปพร้อมย้ำรูปแบบ) */
export async function splitTask(
  task: SplitTask,
  settings: SplitterSettings,
  examples: SplitExample[]
): Promise<SplitResult> {
  const apiKey = process.env.TYPHOON_API_KEY;
  if (!apiKey) return { error: NOT_CONFIGURED };

  let messages = buildSplitMessages(task, settings, examples);
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await callModel(apiKey, messages);
    if ("error" in reply) return reply;

    const items = parseSplitResponse(reply.text, settings);
    if (items) return { items };
    messages = [
      ...messages,
      { role: "assistant", content: reply.text },
      { role: "user", content: SPLIT_RETRY_REMINDER },
    ];
  }
  return { error: "AI ตอบกลับไม่ถูกรูปแบบ ลองกดอีกครั้ง" };
}

async function callModel(apiKey: string, messages: ChatMessage[]): Promise<{ text: string } | { error: string }> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.TYPHOON_MODEL || DEFAULT_TYPHOON_MODEL,
        messages,
        max_tokens: MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error("task-splitter: เรียก Typhoon ไม่สำเร็จ", error);
    return { error: UNAVAILABLE };
  }

  if (response.status === 429) return { error: "มีคนใช้ AI เยอะ ลองใหม่ในอีกสักครู่" };
  if (response.status === 401 || response.status === 403) return { error: "TYPHOON_API_KEY ไม่ถูกต้อง" };
  if (!response.ok) {
    console.error("task-splitter: Typhoon ตอบ", response.status, (await response.text().catch(() => "")).slice(0, 500));
    return { error: UNAVAILABLE };
  }

  const data: unknown = await response.json().catch(() => null);
  const text = (data as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) return { error: UNAVAILABLE };
  return { text };
}
