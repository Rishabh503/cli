-- CreateTable
CREATE TABLE "deviceCode" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "lastPolledAt" TIMESTAMP(3),
    "pollingInterval" INTEGER,
    "clientId" TEXT,
    "scope" TEXT,

    CONSTRAINT "deviceCode_pkey" PRIMARY KEY ("id")
);

-- RenameIndex
ALTER INDEX "account_userId_idx" RENAME TO "account_userId_idx_1";

-- RenameIndex
ALTER INDEX "session_userId_idx" RENAME TO "session_userId_idx_1";

-- RenameIndex
ALTER INDEX "verification_identifier_idx" RENAME TO "verification_identifier_idx_1";
