/**
 * dueDate มาจาก <input type="date"> จึงถูกเก็บเป็นเที่ยงคืน UTC
 * ถ้าเทียบกับ Date.now() ตรง ๆ จะเพี้ยนข้ามวัน เพราะไทยเป็น UTC+7
 * ทุกการเทียบวันในโปรเจกต์นี้จึงทำผ่าน "คีย์วันที่" (YYYY-MM-DD ตามเวลาไทย) เท่านั้น
 */

const DAY_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const THAI_DATE_FORMAT = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
});

const THAI_DATE_FULL_FORMAT = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DueBucket = "overdue" | "today" | "soon" | "later";

export function dateKey(date: Date): string {
  return DAY_KEY_FORMAT.format(date);
}

export function todayKey(): string {
  return dateKey(new Date());
}

/** จำนวน "วันปฏิทิน" ที่เหลือ (ติดลบ = เลยกำหนดมาแล้วกี่วัน) */
export function daysUntilDue(dueDate: Date, now: Date = new Date()): number {
  const due = Date.parse(`${dateKey(dueDate)}T00:00:00Z`);
  const today = Date.parse(`${dateKey(now)}T00:00:00Z`);
  return Math.round((due - today) / MS_PER_DAY);
}

export function dueBucket(dueDate: Date, now: Date = new Date()): DueBucket {
  const days = daysUntilDue(dueDate, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

/** ส่งงานทันกำหนดไหม — ใช้ตัดสินโบนัสแต้ม */
export function isOnTime(dueDate: Date, completedAt: Date): boolean {
  return dateKey(completedAt) <= dateKey(dueDate);
}

export function formatDueThai(date: Date, withYear = false): string {
  return (withYear ? THAI_DATE_FULL_FORMAT : THAI_DATE_FORMAT).format(date);
}

export function dueLabel(dueDate: Date, now: Date = new Date()): string {
  const days = daysUntilDue(dueDate, now);
  if (days < 0) return `เลยกำหนด ${Math.abs(days)} วัน`;
  if (days === 0) return "ครบกำหนดวันนี้";
  if (days === 1) return "ครบกำหนดพรุ่งนี้";
  return `เหลืออีก ${days} วัน`;
}

/** สีของแต่ละกลุ่ม เก็บไว้ที่เดียวเพื่อให้การ์ดบนบอร์ดกับ dashboard ใช้ชุดเดียวกัน */
export const DUE_BUCKET_STYLE: Record<
  DueBucket,
  { title: string; text: string; chip: string; dot: string }
> = {
  overdue: {
    title: "เลยกำหนดส่ง",
    text: "text-danger",
    chip: "bg-danger/15 text-danger",
    dot: "bg-danger",
  },
  today: {
    title: "ครบกำหนดวันนี้",
    text: "text-warn",
    chip: "bg-warn/15 text-warn",
    dot: "bg-warn",
  },
  soon: {
    title: "ภายใน 7 วัน",
    text: "text-info",
    chip: "bg-info/15 text-info",
    dot: "bg-info",
  },
  later: {
    title: "ถัดไป",
    text: "text-muted",
    chip: "bg-panel-2 text-muted",
    dot: "bg-muted",
  },
};

export const DUE_BUCKET_ORDER: DueBucket[] = ["overdue", "today", "soon", "later"];
