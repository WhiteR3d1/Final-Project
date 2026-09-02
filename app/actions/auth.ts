"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/auth";

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

// กัน open redirect: รับเฉพาะ path ภายในเว็บเรา ("/board/x") ไม่รับ "//evil.com" หรือ URL เต็ม
function resolveNextPath(formData: FormData) {
  const next = formData.get("next");
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

/**
 * การจัดการ error ของ signIn() ต้องทำสองชั้น เพราะมันไม่สม่ำเสมอ:
 *  - เรียกจาก Server Action แล้วรหัสผ่านผิด -> โยน CredentialsSignin (ถ้าไม่จับ = 500)
 *  - เรียกผ่าน HTTP route ปกติ -> ไม่โยน แต่คืน URL ที่ติด ?error= กลับมา
 * และต้องใช้ redirect: false ด้วย ไม่งั้นตอนพลาด NextAuth จะ redirect กลับหน้า login เอง
 * ทำให้ state ของ useActionState หายไป ผู้ใช้จะไม่เห็นข้อความบอกว่าผิดตรงไหน
 */
async function signInWithCredentials(
  email: string,
  password: string,
  nextPath: string
): Promise<AuthFormState> {
  const wrongCredentials = { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  let resultUrl: string;

  try {
    // ส่ง redirectTo เป็น "/" คงที่ (ไม่ใช่ nextPath) เพื่อไม่ให้ query string จากผู้ใช้
    // ปนเข้ามาใน URL ที่เราจะเอาไปเช็คว่ามี ?error= หรือเปล่า
    resultUrl = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return wrongCredentials;
    }
    throw error;
  }

  if (new URL(resultUrl, "http://localhost").searchParams.has("error")) {
    return wrongCredentials;
  }

  // สำเร็จแล้ว — signIn เซ็ต session cookie ให้เรียบร้อยก่อน return
  // redirect() ต้องอยู่นอก try/catch เพราะมันทำงานด้วยการโยน NEXT_REDIRECT
  redirect(nextPath);
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

  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  // สมัครเสร็จแล้วล็อกอินให้เลย ผ่าน provider เดียวกับหน้า login
  return signInWithCredentials(email, password, resolveNextPath(formData));
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

  return signInWithCredentials(email, password, resolveNextPath(formData));
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
