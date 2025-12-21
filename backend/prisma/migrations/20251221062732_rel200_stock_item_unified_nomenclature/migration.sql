/*
  Warnings:

  - A unique constraint covering the columns `[fuelTypeId]` on the table `stock_items` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "category" TEXT,
ADD COLUMN     "density" DOUBLE PRECISION,
ADD COLUMN     "fuelTypeId" UUID;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "fuelStockItemId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_fuelTypeId_key" ON "stock_items"("fuelTypeId");

-- CreateIndex
CREATE INDEX "stock_items_organizationId_category_idx" ON "stock_items"("organizationId", "category");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_fuelStockItemId_fkey" FOREIGN KEY ("fuelStockItemId") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_fuelTypeId_fkey" FOREIGN KEY ("fuelTypeId") REFERENCES "fuel_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
