"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";

const DEFAULT_LISTS = ["To Do", "Doing", "Done"];

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
        create: DEFAULT_LISTS.map((listName, index) => ({
          name: listName,
          position: index + 1,
        })),
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
