/*
  Warnings:

  - Added the required column `isHost` to the `LobbySession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lobbyId` to the `LobbySession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LobbySession" ADD COLUMN     "isHost" BOOLEAN NOT NULL,
ADD COLUMN     "lobbyId" TEXT NOT NULL;
