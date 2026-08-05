import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "./session";
import { prisma } from "./prisma";

export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const session = await decrypt(cookieStore.get("session")?.value);

  if (!session?.userId) {
    redirect("/login");
  }

  return { userId: session.userId };
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();

  return prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
  });
});
