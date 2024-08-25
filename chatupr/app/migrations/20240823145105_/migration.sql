/*
  Warnings:

  - You are about to drop the column `userId` on the `LobbySession` table. All the data in the column will be lost.
  - Added the required column `username` to the `LobbySession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LobbySession" DROP COLUMN "userId",
ADD COLUMN     "username" TEXT NOT NULL;
