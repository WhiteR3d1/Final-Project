import type { NextAuthConfig } from "next-auth";

/**
 * ส่วนของ config ที่ "ปลอดภัยกับทุก runtime" — ห้าม import Prisma หรือ bcrypt เข้ามาที่นี่
 * เพราะไฟล์นี้ถูกใช้ใน proxy.ts ซึ่งรันก่อนเข้า app และควรเบาที่สุด
 * ตัว provider จริง (ที่ต้องแตะ database) อยู่ใน auth.ts
 */
export const authConfig = {
  // จำเป็นตอน deploy นอก Vercel (เช่นรันเองบน VPS/Docker) ไม่งั้น NextAuth จะโยน UntrustedHost
  // ตอน dev มันเชื่อ host ให้อัตโนมัติ บั๊กนี้เลยโผล่เฉพาะตอน production build
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    // Credentials provider รองรับเฉพาะ jwt เท่านั้น (เก็บ session ใน cookie ไม่ใช่ database)
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 วัน — เท่ากับ session เดิมที่เขียนเองด้วย jose
  },
  callbacks: {
    // ตอน login สำเร็จ NextAuth จะส่ง `user` มาครั้งเดียว — ยัด id ลง token ไว้ใช้ทุก request ถัดไป
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    // token.sub -> session.user.id เพื่อให้ lib/dal.ts อ่าน userId ได้
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
