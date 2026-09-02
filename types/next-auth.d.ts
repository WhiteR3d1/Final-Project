import type { DefaultSession } from "next-auth";

// ทำให้ session.user.id เป็น string เสมอ (ค่าเริ่มต้นของ NextAuth คือ optional)
// callbacks.session ใน auth.config.ts เป็นคนเซ็ตค่านี้จาก token.sub
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
