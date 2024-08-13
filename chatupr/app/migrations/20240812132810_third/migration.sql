/*
  Warnings:

  - You are about to drop the column `description` on the `Lobby` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lobby" DROP COLUMN "description",
ADD COLUMN     "lobbyState" TEXT NOT NULL DEFAULT 'alive';
