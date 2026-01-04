-- CreateTable
CREATE TABLE "period_locks" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "lockedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedByUserId" UUID NOT NULL,
    "dataHash" CHAR(64) NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "notes" TEXT,
    "lastVerifiedAt" TIMESTAMP(6),
    "lastVerifyResult" BOOLEAN,

    CONSTRAINT "period_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "period_locks_organizationId_period_idx" ON "period_locks"("organizationId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "period_locks_organizationId_period_key" ON "period_locks"("organizationId", "period");

-- AddForeignKey
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
