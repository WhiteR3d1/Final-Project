/*
 * ตัวเลือกของตัวแตกงานย่อยด้วย AI ที่หน้าจอใช้ด้วย — ไฟล์นี้ห้าม import zod
 * (schema อยู่ที่ lib/task-splitter-rules.ts ซึ่งจะลาก zod ทั้งก้อนเข้า bundle ฝั่ง client)
 */

export const SPLITTER_DETAILS = ["brief", "normal", "detailed"] as const;
export type SplitterDetail = (typeof SPLITTER_DETAILS)[number];

/** label โชว์ในหน้าตั้งค่า ส่วน prompt คือสิ่งที่บอก AI — แยกกันเพราะคนอ่านกับ AI ต้องการคำอธิบายคนละแบบ */
export const SPLITTER_DETAIL_OPTIONS: Record<SplitterDetail, { label: string; hint: string; prompt: string }> = {
  brief: {
    label: "กระชับ",
    hint: "ขั้นใหญ่ ๆ เท่าที่จำเป็น เหมาะกับนักศึกษาที่คล่องแล้ว",
    prompt: "กระชับ — แต่ละข้อเป็นขั้นใหญ่ รวมงานเล็ก ๆ ที่เกี่ยวกันไว้ในข้อเดียว",
  },
  normal: {
    label: "ปกติ",
    hint: "ข้อละหนึ่งเรื่อง ทำจบได้ในครั้งเดียว",
    prompt: "ปกติ — ข้อละหนึ่งเรื่อง แต่ละข้อทำจบได้ในการนั่งทำครั้งเดียว",
  },
  detailed: {
    label: "ละเอียดทีละขั้น",
    hint: "ขั้นเล็ก ๆ บอกชัดว่าต้องทำอะไร เหมาะกับผู้เริ่มต้น",
    prompt: "ละเอียด — แตกเป็นขั้นเล็ก ๆ ที่ผู้เริ่มต้นทำตามได้ทันที บอกชัดว่าต้องทำอะไรและเสร็จแล้วได้อะไร",
  },
};

export const SPLITTER_ITEMS_MIN = 2;
export const SPLITTER_ITEMS_MAX = 15;
export const SPLITTER_INSTRUCTIONS_MAX = 1000;

export type SplitterSettings = {
  minItems: number;
  maxItems: number;
  detail: SplitterDetail;
  /** คำสั่งเพิ่มเติมของอาจารย์ — ต่อท้าย prompt เป็นหัวข้อแยก */
  instructions: string;
  /** ส่งงานเก่าของวิชาไปเป็นตัวอย่าง ให้ AI แตกงานตามสไตล์อาจารย์ */
  learnFromPast: boolean;
};

export const DEFAULT_SPLITTER_SETTINGS: SplitterSettings = {
  minItems: 4,
  maxItems: 8,
  detail: "normal",
  instructions: "",
  learnFromPast: true,
};
