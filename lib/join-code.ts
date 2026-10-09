import { randomInt } from "node:crypto";

/**
 * รหัสเข้าร่วมรายวิชา — อาจารย์บอกนักศึกษาปากเปล่าหรือเขียนบนกระดาน
 * จึงตัดตัวที่อ่านสับสนออก (0/O, 1/I/L) และรับรหัสที่พิมพ์มาแบบไม่สนตัวพิมพ์/ช่องว่าง
 */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

/** รับ randomIndex เข้ามาได้เพื่อให้เทสต์กำหนดผลเองได้ */
export function generateJoinCode(randomIndex: (max: number) => number = randomInt): string {
  return Array.from(
    { length: JOIN_CODE_LENGTH },
    () => JOIN_CODE_ALPHABET[randomIndex(JOIN_CODE_ALPHABET.length)]
  ).join("");
}

/** สิ่งที่ผู้ใช้พิมพ์ → รูปแบบที่เก็บใน DB (ตัวใหญ่ ไม่มีช่องว่างหรือขีด) */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}
