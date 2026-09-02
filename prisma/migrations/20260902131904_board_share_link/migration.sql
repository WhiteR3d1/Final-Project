-- CreateTable
CREATE TABLE "BoardShareLink" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "BoardRole" NOT NULL DEFAULT 'EDITOR',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardShareLink_boardId_key" ON "BoardShareLink"("boardId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardShareLink_token_key" ON "BoardShareLink"("token");

-- AddForeignKey
ALTER TABLE "BoardShareLink" ADD CONSTRAINT "BoardShareLink_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
