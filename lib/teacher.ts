/**
 * ใครเป็นอาจารย์ — มาจากรายชื่ออีเมลใน env `TEACHER_EMAILS` (คั่นด้วย comma) ไม่ได้เก็บใน DB
 * อาจารย์ดูได้ทุกบอร์ดโดยไม่ต้องถูกเชิญ และเป็นคนเดียวที่อนุมัติการ์ดเข้าคอลัมน์เสร็จสิ้นได้
 *
 * ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์ (รับ raw เข้ามาได้เพื่อให้เทสต์ไม่ต้องแตะ process.env)
 * ห้าม import ใน client component — env นี้ไม่ได้ขึ้นต้นด้วย NEXT_PUBLIC_ จึงไม่มีค่าฝั่งเบราว์เซอร์
 */
export function parseTeacherEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isTeacherEmail(email: string, raw = process.env.TEACHER_EMAILS): boolean {
  return parseTeacherEmails(raw).has(email.trim().toLowerCase());
}
