"use server";

import * as z from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { newPasswordSchema } from "@/lib/password";

export type PasswordFormState =
  | {
      errors?: { currentPassword?: string[]; newPassword?: string[]; confirmPassword?: string[] };
      message?: string;
    }
  | undefined;

const ChangePasswordSchema = z
  .object({
    // รหัสเดิมเทียบตามที่พิมพ์ (ไม่ trim) เหมือนหน้า login
    currentPassword: z.string().min(1, { error: "กรอกรหัสผ่านเดิม" }),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword.trim(), {
    error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน",
    path: ["confirmPassword"],
  });

/**
 * เปลี่ยนรหัสผ่านของตัวเอง — ต้องรู้รหัสเดิม
 * (session อื่นที่ล็อกอินค้างไว้ไม่หลุด เพราะเป็น JWT ล้วน ดูหนี้ใน CLAUDE.md)
 */
export async function changePasswordAction(
  _state: PasswordFormState,
  formData: FormData
): Promise<PasswordFormState> {
  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { currentPassword, newPassword } = parsed.data;
  const user = await getCurrentUser();

  if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return { errors: { currentPassword: ["รหัสผ่านเดิมไม่ถูกต้อง"] } };
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return { errors: { newPassword: ["รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม"] } };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  return { message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
}
