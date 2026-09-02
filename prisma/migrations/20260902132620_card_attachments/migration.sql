-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('IMAGE', 'FILE', 'LINK');

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT,
    "blobPathname" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_cardId_idx" ON "Attachment"("cardId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
