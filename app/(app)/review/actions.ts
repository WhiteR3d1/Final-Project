"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { assertBoardAccess } from "@/lib/board-access";
import { syncCardCompletion } from "@/lib/card-completion";
import { positionBetween } from "@/lib/drag";
import { ActivityType, ReviewStatus } from "@/app/generated/prisma/enums";

export type ReviewFormState = { error?: string; message?: string } | undefined;

const cardId = z.string().min(1);
const feedback = z.string().trim().max(2000, { error: "ความเห็นยาวเกิน 2,000 ตัวอักษร" });

const ReviewSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("approve"),
    cardId,
    // ช่องว่างต้องไม่กลายเป็น 0 เงียบ ๆ (z.coerce แปลง "" เป็น 0) จึงเช็คว่ากรอกก่อนค่อยแปลง
    score: z
      .string()
      .trim()
      .min(1, { error: "กรอกคะแนนก่อนอนุมัติ" })
      .pipe(
        z.coerce
          .number<string>({ error: "คะแนนต้องเป็นตัวเลข" })
          .int({ error: "คะแนนต้องเป็นจำนวนเต็ม" })
          .min(0, { error: "คะแนนต้องอยู่ระหว่าง 0–100" })
          .max(100, { error: "คะแนนต้องอยู่ระหว่าง 0–100" })
      ),
    feedback,
  }),
  z.object({
    intent: z.literal("changes"),
    cardId,
    feedback: feedback.min(1, { error: "บอกนักศึกษาหน่อยว่าต้องแก้อะไร" }),
  }),
]);

/**
 * อาจารย์ตรวจการ์ด — อนุมัติ (ให้คะแนน + ย้ายเข้าคอลัมน์เสร็จสิ้น) หรือส่งกลับแก้ไข
 * ทางเดียวที่การ์ดเข้าคอลัมน์เสร็จสิ้นได้ในบอร์ดที่มีคอลัมน์ตรวจ (ดู needsTeacherApproval)
 */
export async function reviewCardAction(
  _state: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const parsed = ReviewSchema.safeParse({
    intent: formData.get("intent"),
    cardId: formData.get("cardId"),
    score: formData.get("score") ?? "",
    feedback: formData.get("feedback") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const input = parsed.data;

  const user = await getCurrentUser();

  const card = await prisma.card.findUnique({
    where: { id: input.cardId },
    include: {
      list: { select: { boardId: true, isReviewList: true, isDoneList: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!card) return { error: "ไม่พบการ์ดนี้ อาจถูกลบไปแล้ว" };

  const boardId = card.list.boardId;
  const access = await assertBoardAccess(boardId, user);
  if (!access?.canReview) return { error: "เฉพาะอาจารย์เท่านั้นที่ตรวจงานได้" };

  // ตรวจซ้ำการ์ดที่อนุมัติไปแล้วได้ (แก้คะแนน) แต่การ์ดที่ยังไม่ส่งตรวจไม่ควรถูกตรวจ
  if (!card.list.isReviewList && !card.list.isDoneList) {
    return { error: "การ์ดนี้ยังไม่ได้ส่งตรวจ" };
  }

  const lists = await prisma.list.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    select: { id: true, name: true, isDoneList: true, isReviewList: true },
  });

  const teacherName = user.name ?? user.email;
  // แต้มไปที่คนส่งตรวจ — การ์ดที่อยู่ในคอลัมน์ตรวจมาก่อนมีฟีเจอร์นี้ไม่มีคนส่ง จึงใช้คนสร้างแทน
  const earner = card.submittedBy ?? card.createdBy;

  if (input.intent === "approve") {
    const doneList = lists.find((list) => list.isDoneList);
    if (!doneList) return { error: "บอร์ดนี้ยังไม่มีคอลัมน์เสร็จสิ้น" };

    const awarded = await prisma.$transaction(async (tx) => {
      await tx.cardReview.upsert({
        where: { cardId: card.id },
        create: {
          cardId: card.id,
          reviewerId: user.id,
          status: ReviewStatus.APPROVED,
          score: input.score,
          feedback: input.feedback || null,
        },
        update: {
          reviewerId: user.id,
          status: ReviewStatus.APPROVED,
          score: input.score,
          feedback: input.feedback || null,
        },
      });

      if (card.listId !== doneList.id) {
        const last = await tx.card.findFirst({
          where: { listId: doneList.id },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        await tx.card.update({
          where: { id: card.id },
          data: { listId: doneList.id, position: positionBetween(last?.position, undefined) },
        });
      }

      await tx.activity.create({
        data: {
          boardId,
          cardId: card.id,
          userId: user.id,
          type: ActivityType.CARD_REVIEWED,
          message: `${teacherName} approved "${card.title}" (score ${input.score})`,
        },
      });

      // เวลาส่งตรวจ ไม่ใช่เวลาที่อาจารย์กด — ตรวจช้าแล้วนักศึกษาต้องไม่เสียโบนัสส่งทันกำหนด
      return syncCardCompletion(tx, card, doneList, boardId, earner, card.submittedAt);
    });

    revalidateReview(boardId);
    return {
      message:
        awarded > 0
          ? `อนุมัติแล้ว ${earner.name ?? earner.email} ได้ +${awarded} แต้ม`
          : "บันทึกผลตรวจแล้ว",
    };
  }

  // ส่งกลับไปคอลัมน์ที่อยู่ก่อนคอลัมน์ตรวจ (ปกติคือ "กำลังทำ")
  const reviewIndex = lists.findIndex((list) => list.isReviewList);
  const target =
    reviewIndex > 0
      ? lists[reviewIndex - 1]
      : lists.find((list) => !list.isReviewList && !list.isDoneList);
  if (!target || target.isDoneList) return { error: "ไม่พบคอลัมน์ที่จะส่งการ์ดกลับไป" };

  await prisma.$transaction(async (tx) => {
    await tx.cardReview.upsert({
      where: { cardId: card.id },
      create: {
        cardId: card.id,
        reviewerId: user.id,
        status: ReviewStatus.CHANGES_REQUESTED,
        feedback: input.feedback,
      },
      update: {
        reviewerId: user.id,
        status: ReviewStatus.CHANGES_REQUESTED,
        score: null,
        feedback: input.feedback,
      },
    });

    const last = await tx.card.findFirst({
      where: { listId: target.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    await tx.card.update({
      where: { id: card.id },
      data: { listId: target.id, position: positionBetween(last?.position, undefined) },
    });

    await tx.activity.create({
      data: {
        boardId,
        cardId: card.id,
        userId: user.id,
        type: ActivityType.CARD_REVIEWED,
        message: `${teacherName} requested changes on "${card.title}"`,
      },
    });

    // ส่งกลับจากคอลัมน์เสร็จสิ้น = การ์ดกลับเป็น "กำลังทำ" (แต้มที่ได้ไปแล้วไม่ถูกริบตามกติกาเดิม)
    await syncCardCompletion(tx, card, target, boardId, earner);
  });

  revalidateReview(boardId);
  return { message: `ส่งกลับไปที่ "${target.name}" แล้ว` };
}

function revalidateReview(boardId: string) {
  revalidatePath("/review");
  revalidatePath(`/board/${boardId}`);
  // แต้ม/สถิติบน dashboard ของนักศึกษา และตัวเลขรอตรวจบน sidebar ของอาจารย์
  revalidatePath("/");
}
