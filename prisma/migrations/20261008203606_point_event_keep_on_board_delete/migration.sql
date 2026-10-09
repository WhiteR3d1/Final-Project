-- DropForeignKey
ALTER TABLE "PointEvent" DROP CONSTRAINT "PointEvent_boardId_fkey";

-- AlterTable
ALTER TABLE "PointEvent" ALTER COLUMN "boardId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;
