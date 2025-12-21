/*
  Warnings:

  - You are about to drop the column `fuelTypeId` on the `stock_items` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fuelTypeLegacyId]` on the table `stock_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,name]` on the table `stock_items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StockItemCategory" AS ENUM ('FUEL', 'MATERIAL', 'SPARE_PART', 'SERVICE', 'OTHER');

-- DropForeignKey
ALTER TABLE "stock_items" DROP CONSTRAINT "stock_items_fuelTypeId_fkey";

-- DropIndex
DROP INDEX "stock_items_fuelTypeId_key";

-- DropIndex
DROP INDEX "stock_items_organizationId_category_idx";

-- AlterTable
ALTER TABLE "stock_items" DROP COLUMN "fuelTypeId",
ADD COLUMN     "categoryEnum" "StockItemCategory",
ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "fuelTypeLegacyId" UUID,
ALTER COLUMN "unit" SET DEFAULT 'л';

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_fuelTypeLegacyId_key" ON "stock_items"("fuelTypeLegacyId");

-- CreateIndex
CREATE INDEX "stock_items_organizationId_categoryEnum_idx" ON "stock_items"("organizationId", "categoryEnum");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_organizationId_name_key" ON "stock_items"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_fuelTypeLegacyId_fkey" FOREIGN KEY ("fuelTypeLegacyId") REFERENCES "fuel_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
