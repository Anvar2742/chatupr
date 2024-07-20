/*
  Warnings:

  - You are about to drop the column `name` on the `Lobby` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lobby" DROP COLUMN "name",
ADD COLUMN     "roomId" TEXT;
