/*
  Warnings:

  - Added the required column `canPlay` to the `LobbySession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LobbySession" ADD COLUMN     "canPlay" BOOLEAN NOT NULL;
