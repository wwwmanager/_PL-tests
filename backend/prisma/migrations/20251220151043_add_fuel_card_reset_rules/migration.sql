-- CreateEnum
CREATE TYPE "ResetFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "ResetMode" AS ENUM ('TRANSFER_TO_WAREHOUSE', 'EXPIRE_EXPENSE');

-- CreateEnum
CREATE TYPE "ResetScope" AS ENUM ('ALL_CARDS', 'BY_PROVIDER', 'BY_DEPARTMENT', 'SPECIFIC_CARDS');

-- CreateTable
CREATE TABLE "fuel_card_reset_rules" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "ResetFrequency" NOT NULL,
    "nextRunAt" TIMESTAMP(6),
    "lastRunAt" TIMESTAMP(6),
    "scope" "ResetScope" NOT NULL DEFAULT 'ALL_CARDS',
    "providerFilter" TEXT,
    "departmentId" UUID,
    "cardIds" UUID[],
    "mode" "ResetMode" NOT NULL DEFAULT 'EXPIRE_EXPENSE',
    "targetLocationId" UUID,
    "stockItemId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_card_reset_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuel_card_reset_rules_organizationId_isActive_nextRunAt_idx" ON "fuel_card_reset_rules"("organizationId", "isActive", "nextRunAt");

-- AddForeignKey
ALTER TABLE "fuel_card_reset_rules" ADD CONSTRAINT "fuel_card_reset_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_card_reset_rules" ADD CONSTRAINT "fuel_card_reset_rules_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_card_reset_rules" ADD CONSTRAINT "fuel_card_reset_rules_targetLocationId_fkey" FOREIGN KEY ("targetLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_card_reset_rules" ADD CONSTRAINT "fuel_card_reset_rules_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
