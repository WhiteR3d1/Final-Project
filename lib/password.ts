import * as z from "zod";

/**
 * กติการหัสผ่านใหม่ — ใช้ร่วมกันทั้งสมัคร / เปลี่ยนรหัสเอง / แอดมินตั้งให้
 * แยกออกมาเพราะไฟล์ "use server" export ได้แค่ async function ประกาศ schema ไว้ในนั้นแล้วแชร์ไม่ได้
 * trim ก่อน min — ไม่งั้นช่องว่างล้วน 8 ตัวผ่านแล้วกลายเป็นรหัสว่าง
 */
export const newPasswordSchema = z
  .string()
  .trim()
  .min(8, { error: "รหัสผ่านอย่างน้อย 8 ตัวอักษร" })
  .max(200, { error: "รหัสผ่านยาวเกินไป" });
