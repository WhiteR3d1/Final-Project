"use server";

import * as z from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { canManageUsers, isAdminEmail } from "@/lib/roles";
import { newPasswordSchema } from "@/lib/password";
import { UserRole } from "@/app/generated/prisma/enums";

export type ResetPasswordState = { error?: string; message?: string } | undefined;

/**
 * แอดมิน + ผู้ใช้เป้าหมายที่แก้ได้ หรือ null — ทุก action ในไฟล์นี้ต้องผ่านด่านนี้
 * แก้ตัวเองไม่ได้ (กันลดสิทธิ์/ระงับตัวเองจนไม่มีใครกู้) และแก้แอดมินจาก env ไม่ได้
 * (env คือทางเข้าระบบสุดท้าย ถ้าระงับหรือเปลี่ยนรหัสได้ ก็ล็อกเขาออกได้)
 */
async function editableTarget(targetId: FormDataEntryValue | null) {
  if (typeof targetId !== "string") return null;

  const admin = await getCurrentUser();
  if (!canManageUsers(admin.role) || targetId === admin.id) return null;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true },
  });
  if (!target || isAdminEmail(target.email)) return null;

  return target;
}

/**
 * อาจารย์ที่ยังเป็นเจ้าของรายวิชาอยู่ห้ามถูกลดเป็นนักศึกษาหรือถูกระงับ — ไม่งั้นบอร์ดในวิชานั้น
 * ค้างรออนุมัติตลอดไปเพราะไม่มีใครอนุมัติได้ (ให้เขาลบ/ย้ายวิชาก่อน)
 */
async function teachesCourses(userId: string) {
  return (await prisma.course.count({ where: { teacherId: userId } })) > 0;
}

export async function setUserRoleAction(formData: FormData) {
  const role = z.enum(UserRole).safeParse(formData.get("role"));
  if (!role.success) return;

  const target = await editableTarget(formData.get("userId"));
  if (!target) return;
  if (role.data === UserRole.USER && (await teachesCourses(target.id))) return;

  await prisma.user.update({ where: { id: target.id }, data: { role: role.data } });

  revalidatePath("/admin");
}

export async function setUserDisabledAction(formData: FormData) {
  const disabled = formData.get("disabled") === "1";

  const target = await editableTarget(formData.get("userId"));
  if (!target) return;
  if (disabled && (await teachesCourses(target.id))) return;

  await prisma.user.update({
    where: { id: target.id },
    data: { disabledAt: disabled ? new Date() : null },
  });

  revalidatePath("/admin");
}

/** แอดมินตั้งรหัสใหม่ให้เอง (ระบบไม่มีการส่งอีเมล) — แล้วค่อยบอกผู้ใช้ทางอื่น */
export async function resetUserPasswordAction(
  _state: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = newPasswordSchema.safeParse(formData.get("password"));
  if (!password.success) return { error: password.error.issues[0]?.message ?? "รหัสผ่านไม่ถูกต้อง" };

  const target = await editableTarget(formData.get("userId"));
  if (!target) return { error: "แก้บัญชีนี้ไม่ได้" };

  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash: await bcrypt.hash(password.data, 10) },
  });

  return { message: `ตั้งรหัสใหม่ให้ ${target.email} แล้ว` };
}
