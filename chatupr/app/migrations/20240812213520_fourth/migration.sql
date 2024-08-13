/*
  Warnings:

  - A unique constraint covering the columns `[detectiveId]` on the table `Lobby` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "detectiveId" TEXT NOT NULL DEFAULT 'null';

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_detectiveId_key" ON "Lobby"("detectiveId");
