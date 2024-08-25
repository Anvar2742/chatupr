-- CreateTable
CREATE TABLE "LobbySession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "isReady" BOOLEAN NOT NULL,
    "isDetective" BOOLEAN NOT NULL,

    CONSTRAINT "LobbySession_pkey" PRIMARY KEY ("id")
);
