/**
 * สร้างไฟล์ CSV สำหรับเปิดใน Excel — ฟังก์ชันบริสุทธิ์ เทสต์ได้
 *
 * - ขึ้นต้นด้วย BOM ไม่งั้น Excel เปิด UTF-8 แล้วภาษาไทยเพี้ยน
 * - ค่าที่ขึ้นต้นด้วย = + - @ tab หรือ CR ถูกเติม ' นำหน้า (กัน CSV/formula injection:
 *   ชื่อการ์ดหรือความเห็นที่นักศึกษาพิมพ์ว่า `=HYPERLINK(...)` จะกลายเป็นสูตรในเครื่องอาจารย์)
 * - ตัวเลขไม่ต้องกัน เพราะเราเป็นคนสร้างเองไม่ได้มาจากผู้ใช้
 */
export type CsvValue = string | number | null | undefined;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);

  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: CsvValue[][]): string {
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
