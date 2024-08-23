/*
  Warnings:

  - Added the required column `isRobot` to the `LobbyMessage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LobbyMessage" ADD COLUMN     "isRobot" BOOLEAN NOT NULL;
