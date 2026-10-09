import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "./prisma";
import { effectiveRole, isAdminEmail } from "./roles";

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

/**
 * ผู้ใช้ตาม session โดยไม่สนว่าถูกระงับไหม — **ใช้ได้ที่หน้า /suspended ที่เดียว**
 * ที่อื่นต้องใช้ getCurrentUser() ไม่งั้นบัญชีที่ถูกระงับยังใช้งานต่อได้
 */
export const getSessionUser = cache(async () => {
  const session = await verifySession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
  });

  // role คำนวณที่นี่ที่เดียว ห้ามเก็บใน JWT — เปลี่ยน role แล้วจะค้างได้ถึง 7 วันตามอายุ session
  return { ...user, role: effectiveRole(user) };
});

export const getCurrentUser = cache(async () => {
  const user = await getSessionUser();

  // JWT ยังไม่หมดอายุ proxy จึงยังมองว่าล็อกอินอยู่ — ต้องพาไปหน้าที่ไม่เรียกฟังก์ชันนี้ ไม่งั้นวนลูป
  // แอดมินจาก env ระงับไม่ได้ (ทางกลับเข้าระบบสุดท้าย)
  if (user.disabledAt && !isAdminEmail(user.email)) {
    redirect("/suspended");
  }

  return user;
});
