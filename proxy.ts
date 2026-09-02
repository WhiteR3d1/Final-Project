import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// ใช้ instance แยกที่ไม่มี Credentials provider — proxy แค่ต้องอ่าน session cookie
// ไม่ต้องแตะ database ตรงนี้ (ดูหมายเหตุใน auth.config.ts)
const { auth } = NextAuth(authConfig);

const publicRoutes = ["/login", "/signup"];

// เช็คแบบ optimistic เท่านั้น — การกันสิทธิ์ของจริงอยู่ที่ lib/dal.ts + lib/board-access.ts
export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);
  const isLoggedIn = Boolean(req.auth?.user?.id);

  if (!isPublicRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    // ต้องพก query string ไปด้วย ไม่งั้น /search?q=... กลับมาแล้วคำค้นหาย
    loginUrl.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\.png$).*)"],
};
