-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'CARD_REVIEWED';

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT;

-- AlterTable
ALTER TABLE "List" ADD COLUMN     "isReviewList" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CardReview" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL,
    "score" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardReview_cardId_key" ON "CardReview"("cardId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReview" ADD CONSTRAINT "CardReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReview" ADD CONSTRAINT "CardReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data: บอร์ดเก่าที่ยังไม่ได้ตั้งคอลัมน์เสร็จสิ้น ให้คอลัมน์ที่ชื่อสื่อว่า "เสร็จ" เป็นคอลัมน์เสร็จสิ้นเอง
-- รายชื่อต้องตรงกับ DONE_LIST_NAMES ใน lib/drag.ts
-- การ์ดในคอลัมน์นั้นถูกมาร์กว่าเสร็จแบบเดียวกับ setDoneListAction (ไม่ให้แต้มย้อนหลัง ไม่เซ็ต completedAt)
WITH flagged AS (
  UPDATE "List" SET "isDoneList" = true
  WHERE "id" IN (
    SELECT DISTINCT ON ("boardId") "id" FROM "List"
    WHERE lower(btrim("name")) IN ('done', 'finish', 'finished', 'complete', 'completed', 'เสร็จ', 'เสร็จสิ้น', 'เสร็จแล้ว')
      AND "boardId" NOT IN (SELECT "boardId" FROM "List" WHERE "isDoneList")
    ORDER BY "boardId", "position" DESC
  )
  RETURNING "id"
)
UPDATE "Card" SET "isCompleted" = true
WHERE "listId" IN (SELECT "id" FROM flagged) AND "isCompleted" = false;

-- Data: คอลัมน์เสร็จสิ้นต้องอยู่ขวาสุดเสมอ
UPDATE "List" AS done SET "position" = latest."maxPosition" + 1
FROM (SELECT "boardId", max("position") AS "maxPosition" FROM "List" GROUP BY "boardId") AS latest
WHERE done."isDoneList" AND done."boardId" = latest."boardId" AND done."position" < latest."maxPosition";
