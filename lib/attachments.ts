/**
 * กติกาของไฟล์แนบที่เป็นคณิตศาสตร์/สตริงล้วน ไม่แตะ DB และไม่แตะ Blob — แยกออกมาเพื่อให้เทสต์ได้
 * ตัวที่ยิง Vercel Blob จริงอยู่ใน app/(app)/board/[id]/actions.ts
 */

/** ชนิดเดียวกับ enum AttachmentType ใน schema (เขียนเป็น union เพื่อไม่ให้ไฟล์นี้ต้อง import Prisma) */
export type AttachmentKind = "IMAGE" | "FILE" | "LINK";

/**
 * เพดานไฟล์ 4MB — Vercel serverless รับ request ได้ราว 4.5MB เท่านั้น
 * ตั้งต่ำกว่านั้นเล็กน้อยเผื่อ overhead ของ multipart
 */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp"];

/**
 * รับเฉพาะ http/https — ปล่อย javascript: หรือ data: เข้าไปแล้วเรนเดอร์เป็น href เมื่อไหร่
 * ก็กลายเป็นช่องโหว่ XSS ทันที คืน null = ไม่รับ
 */
export function sanitizeAttachmentUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}

/**
 * เดาชนิดของไฟล์ที่อัปโหลด — เชื่อ mime type ก่อนเสมอ ชื่อไฟล์ปลอมนามสกุลได้
 * ไม่มี mime type (เบราว์เซอร์บางตัวส่งมาว่าง) ค่อยเดาจากนามสกุล
 */
export function attachmentKindForUpload(fileName: string, mimeType?: string | null): AttachmentKind {
  if (mimeType) return mimeType.startsWith("image/") ? "IMAGE" : "FILE";

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(extension) ? "IMAGE" : "FILE";
}

/** ชื่อที่จะใช้แสดงเมื่อผู้ใช้ไม่ได้ตั้งชื่อให้ลิงก์ — เอาชื่อโฮสต์ก็พอ */
export function attachmentNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment ? decodeURIComponent(lastSegment) : parsed.hostname;
  } catch {
    return url;
  }
}

export function isWithinAttachmentSizeLimit(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_ATTACHMENT_BYTES;
}

/** ขนาดไฟล์แบบอ่านง่าย — ปัดเป็นทศนิยม 1 ตำแหน่งตั้งแต่หน่วย KB ขึ้นไป */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
