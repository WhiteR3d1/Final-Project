/**
 * role ของผู้ใช้ทั้งระบบ — ฟังก์ชันบริสุทธิ์ (ไม่แตะ DB) จึงเทสต์ได้
 *
 * - role ปกติเก็บใน `User.role` ตั้งจากหน้า /admin
 * - อีเมลใน env `ADMIN_EMAILS` เป็น ADMIN เสมอไม่ว่าใน DB จะเป็นอะไร — ทางเข้าของแอดมินคนแรก
 *   และกันแอดมินล็อกตัวเองออก
 *
 * ห้ามอ่าน `user.role` ตรง ๆ ที่อื่น ให้ใช้ role จาก getCurrentUser() ซึ่งผ่าน effectiveRole() แล้ว
 * ห้าม import ใน client component — env นี้ไม่มีค่าฝั่งเบราว์เซอร์
 */

/** ชนิดเดียวกับ enum UserRole ใน schema (เขียนเป็น union เพื่อไม่ให้ไฟล์นี้ต้อง import Prisma) */
export type UserRoleName = "USER" | "TEACHER" | "ADMIN";

export function parseEmailList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string, raw = process.env.ADMIN_EMAILS): boolean {
  return parseEmailList(raw).has(email.trim().toLowerCase());
}

export function effectiveRole(
  user: { email: string; role: UserRoleName },
  adminEmails = process.env.ADMIN_EMAILS
): UserRoleName {
  return isAdminEmail(user.email, adminEmails) ? "ADMIN" : user.role;
}

/** สร้างรายวิชาและตรวจงานได้ — แอดมินทำได้ทุกอย่างที่อาจารย์ทำได้ (แต่เฉพาะวิชาของตัวเอง) */
export function canTeach(role: UserRoleName): boolean {
  return role === "TEACHER" || role === "ADMIN";
}

export function canManageUsers(role: UserRoleName): boolean {
  return role === "ADMIN";
}

export const ROLE_LABEL: Record<UserRoleName, string> = {
  USER: "นักศึกษา",
  TEACHER: "อาจารย์",
  ADMIN: "แอดมิน",
};
