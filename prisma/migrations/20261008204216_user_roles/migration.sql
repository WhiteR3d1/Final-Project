-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'TEACHER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Data: อีเมลเป็นตัวพิมพ์เล็กเสมอ (เช็คแล้วว่าไม่มีอีเมลที่ต่างกันแค่ตัวพิมพ์ ไม่งั้นบรรทัดนี้ชน unique)
UPDATE "User" SET "email" = lower("email") WHERE "email" <> lower("email");
