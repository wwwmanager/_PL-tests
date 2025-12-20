/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,externalRef]` on the table `stock_movements` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "fromStockLocationId" UUID,
ADD COLUMN     "occurredAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "occurredSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockLocationId" UUID,
ADD COLUMN     "toStockLocationId" UUID;

-- CreateIndex
CREATE INDEX "stock_movements_stockLocationId_stockItemId_occurredAt_idx" ON "stock_movements"("stockLocationId", "stockItemId", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_movements_fromStockLocationId_stockItemId_occurredAt_idx" ON "stock_movements"("fromStockLocationId", "stockItemId", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_movements_toStockLocationId_stockItemId_occurredAt_idx" ON "stock_movements"("toStockLocationId", "stockItemId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_organizationId_externalRef_key" ON "stock_movements"("organizationId", "externalRef");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_fromStockLocationId_fkey" FOREIGN KEY ("fromStockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_toStockLocationId_fkey" FOREIGN KEY ("toStockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
