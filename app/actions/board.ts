"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";

// คอลัมน์ตรวจกับคอลัมน์เสร็จสิ้นตั้งธงให้ตั้งแต่สร้าง (ตามคำแนะนำของอาจารย์) และเสร็จสิ้นอยู่ขวาสุดเสมอ
const DEFAULT_LISTS = [
  { name: "สิ่งที่ต้องทำ" },
  { name: "กำลังทำ" },
  { name: "กำลังตรวจสอบ", isReviewList: true },
  { name: "เสร็จสิ้น", isDoneList: true },
];

/** ค่าจาก FormData เป็น unknown เสมอ — ช่องที่ปล่อยว่างให้เป็น null */
function optionalText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function createBoardAction(formData: FormData) {
  const name = formData.get("name");

  if (typeof name !== "string" || !name.trim()) {
    return;
  }

  const user = await getCurrentUser();

  const board = await prisma.board.create({
    data: {
      name: name.trim(),
      color: optionalText(formData.get("color")),
      description: optionalText(formData.get("description")),
      ownerId: user.id,
      lists: {
        create: DEFAULT_LISTS.map((list, index) => ({ ...list, position: index + 1 })),
      },
    },
  });

  redirect(`/board/${board.id}`);
}

/**
 * แก้ชื่อ/สี/คำอธิบายของบอร์ด — **เฉพาะเจ้าของ**
 * ไม่ใช้ canEdit เพราะการเปลี่ยนตัวตนของบอร์ดเป็นสิทธิ์ระดับเจ้าของ เท่ากับการเชิญสมาชิก
 */
export async function updateBoardAction(formData: FormData) {
  const boardId = formData.get("boardId");
  const name = formData.get("name");

  if (typeof boardId !== "string" || typeof name !== "string" || !name.trim()) {
    return;
  }

  const user = await getCurrentUser();

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });
  if (board?.ownerId !== user.id) return;

  await prisma.board.update({
    where: { id: boardId },
    data: {
      name: name.trim(),
      color: optionalText(formData.get("color")),
      description: optionalText(formData.get("description")),
    },
  });

  revalidatePath(`/board/${boardId}`);
  // sidebar กับ dashboard โชว์ชื่อและสีบอร์ดอยู่ด้วย
  revalidatePath("/");
}

/**
 * ลบบอร์ดทั้งบอร์ด — **เฉพาะเจ้าของ** คอลัมน์/การ์ด/กิจกรรม cascade ตามไป
 * แต่ PointEvent แค่หลุดจากบอร์ด (boardId → null) แต้มที่ได้ไปแล้วไม่ถูกริบ
 */
export async function deleteBoardAction(formData: FormData) {
  const boardId = formData.get("boardId");
  if (typeof boardId !== "string") return;

  const user = await getCurrentUser();

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, courseId: true },
  });
  if (board?.ownerId !== user.id) return;
  // บอร์ดในรายวิชาลบไม่ได้ (คะแนนจะหายจาก CSV) — อาจารย์ต้องถอนออกจากวิชาก่อน
  if (board.courseId) return;

  // เก็บ path ของไฟล์ก่อนลบแถว ไม่งั้นไฟล์ใน Blob ค้างกินโควตาโดยไม่มีใครรู้
  const uploads = await prisma.attachment.findMany({
    where: { card: { list: { boardId } }, blobPathname: { not: null } },
    select: { blobPathname: true },
  });

  await prisma.board.delete({ where: { id: boardId } });

  // ลบไฟล์หลังลบใน DB และไม่ให้ความล้มเหลวตรงนี้ทำให้ลบบอร์ดไม่ได้
  // (ไม่มี BLOB_READ_WRITE_TOKEN หรือ Blob ล่ม ก็แค่เหลือไฟล์กำพร้า)
  const pathnames = uploads.flatMap((upload) => (upload.blobPathname ? [upload.blobPathname] : []));
  if (pathnames.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(pathnames);
    } catch {
      console.error(`Could not delete ${pathnames.length} blob file(s) of deleted board ${boardId}`);
    }
  }

  // sidebar อยู่ใน layout ต้อง revalidate ทั้ง layout ไม่งั้นบอร์ดที่ลบแล้วยังค้างอยู่ในรายการ
  revalidatePath("/", "layout");
  redirect("/");
}
