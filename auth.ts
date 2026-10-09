import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import * as z from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { isAdminEmail } from "@/lib/roles";

/** บัญชีถูกระงับ — app/actions/auth.ts จับ code นี้เพื่อบอกผู้ใช้ตรง ๆ แทนข้อความกลาง */
export class AccountDisabled extends CredentialsSignin {
  code = "disabled";
}

const CredentialsSchema = z.object({
  // อีเมลเก็บเป็นตัวพิมพ์เล็กเสมอ (ดู schema.prisma) จึงต้องแปลงก่อนค้น
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      // คืน null = เข้าสู่ระบบไม่ผ่าน (NextAuth จะโยน CredentialsSignin ให้ action ไปจับต่อ)
      // ห้ามคืน error ที่บอกว่า "อีเมลผิด" หรือ "รหัสผ่านผิด" แยกกัน — เปิดช่องให้เดาว่ามีอีเมลนี้ในระบบ
      async authorize(credentials) {
        const parsed = CredentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        // เช็คหลังรหัสถูกเท่านั้น — ถ้าเช็คก่อน คนเดารหัสจะรู้ว่าบัญชีนี้มีอยู่และถูกระงับ
        if (user.disabledAt && !isAdminEmail(user.email)) {
          throw new AccountDisabled();
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});
