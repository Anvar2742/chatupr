/*
  Warnings:

  - A unique constraint covering the columns `[lobbyId]` on the table `LobbyMessage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LobbyMessage_lobbyId_key" ON "LobbyMessage"("lobbyId");
