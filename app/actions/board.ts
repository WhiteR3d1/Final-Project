"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";

const DEFAULT_LISTS = ["To Do", "Doing", "Done"];

export async function createBoardAction(formData: FormData) {
  const name = formData.get("name");

  if (typeof name !== "string" || !name.trim()) {
    return;
  }

  const user = await getCurrentUser();

  const board = await prisma.board.create({
    data: {
      name: name.trim(),
      ownerId: user.id,
      lists: {
        create: DEFAULT_LISTS.map((listName, index) => ({
          name: listName,
          position: index + 1,
        })),
      },
    },
  });

  redirect(`/board/${board.id}`);
}
