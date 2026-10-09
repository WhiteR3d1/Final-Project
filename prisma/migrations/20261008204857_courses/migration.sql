-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "courseId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reviewsSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_joinCode_key" ON "Course"("joinCode");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data: ผู้ใช้เดิมเริ่มนับแจ้งเตือนจากตอนนี้ ไม่งั้นผลตรวจเก่าทั้งหมดจะขึ้นเป็นยังไม่อ่าน
UPDATE "User" SET "reviewsSeenAt" = CURRENT_TIMESTAMP WHERE "reviewsSeenAt" IS NULL;
