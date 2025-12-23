-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "isVoid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(6),
ADD COLUMN     "voidedByUserId" UUID;

-- CreateIndex
CREATE INDEX "stock_movements_organizationId_isVoid_occurredAt_idx" ON "stock_movements"("organizationId", "isVoid", "occurredAt");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
