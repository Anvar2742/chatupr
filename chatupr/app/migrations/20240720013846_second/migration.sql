/*
  Warnings:

  - A unique constraint covering the columns `[roomId]` on the table `Lobby` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Lobby_roomId_key" ON "Lobby"("roomId");
