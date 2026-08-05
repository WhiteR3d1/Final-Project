"use server";

import * as z from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

export type AuthFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

function resolveNextPath(formData: FormData) {
  const next = formData.get("next");
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

const SignupFormSchema = z.object({
  name: z.string().min(2, { error: "ชื่ออย่างน้อย 2 ตัวอักษร" }).trim(),
  email: z.email({ error: "อีเมลไม่ถูกต้อง" }).trim(),
  password: z.string().min(8, { error: "รหัสผ่านอย่างน้อย 8 ตัวอักษร" }).trim(),
});

export async function signup(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const validated = SignupFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { name, email, password } = validated.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { message: "อีเมลนี้ถูกใช้งานแล้ว" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  await createSession(user.id);
  redirect(resolveNextPath(formData));
}

const LoginFormSchema = z.object({
  email: z.email({ error: "อีเมลไม่ถูกต้อง" }).trim(),
  password: z.string().min(1, { error: "กรุณากรอกรหัสผ่าน" }),
});

export async function login(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const validated = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { email, password } = validated.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    return { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  await createSession(user.id);
  redirect(resolveNextPath(formData));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
