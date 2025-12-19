-- CreateEnum
CREATE TYPE "FuelCardTransactionType" AS ENUM ('TOPUP', 'ADJUSTMENT', 'DEBIT');

-- CreateEnum
CREATE TYPE "TopUpScheduleType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "fuel_cards" ADD COLUMN     "balanceLiters" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "fuel_card_transactions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "fuelCardId" UUID NOT NULL,
    "type" "FuelCardTransactionType" NOT NULL,
    "amountLiters" DECIMAL(14,3) NOT NULL,
    "reason" TEXT,
    "periodKey" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_card_topup_rules" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "fuelCardId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scheduleType" "TopUpScheduleType" NOT NULL,
    "amountLiters" DECIMAL(14,3) NOT NULL,
    "minBalanceLiters" DECIMAL(14,3),
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_card_topup_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuel_card_transactions_organizationId_fuelCardId_createdAt_idx" ON "fuel_card_transactions"("organizationId", "fuelCardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_card_transactions_organizationId_fuelCardId_type_perio_key" ON "fuel_card_transactions"("organizationId", "fuelCardId", "type", "periodKey");

-- CreateIndex
CREATE INDEX "fuel_card_topup_rules_organizationId_isActive_nextRunAt_idx" ON "fuel_card_topup_rules"("organizationId", "isActive", "nextRunAt");

-- AddForeignKey
ALTER TABLE "fuel_card_transactions" ADD CONSTRAINT "fuel_card_transactions_fuelCardId_fkey" FOREIGN KEY ("fuelCardId") REFERENCES "fuel_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_card_transactions" ADD CONSTRAINT "fuel_card_transactions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_card_topup_rules" ADD CONSTRAINT "fuel_card_topup_rules_fuelCardId_fkey" FOREIGN KEY ("fuelCardId") REFERENCES "fuel_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
