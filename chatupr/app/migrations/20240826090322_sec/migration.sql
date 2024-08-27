/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `LobbySession` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LobbySession_username_key" ON "LobbySession"("username");
