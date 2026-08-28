import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "./prisma";

/**
 * แหล่งความจริงเดียวของ "ตอนนี้ใครล็อกอินอยู่"
 * ทุก Server Action / page ที่ต้องรู้ตัวตนผู้ใช้ ให้เรียกผ่านสองฟังก์ชันนี้เท่านั้น
 * ห้ามอ่าน cookie หรือเรียก auth() ตรง ๆ จากที่อื่น
 */
export const verifySession = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return { userId: session.user.id };
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();

  return prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
  });
});
