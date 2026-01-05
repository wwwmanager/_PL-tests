/*
  Warnings:

  - You are about to drop the column `manufactureYears` on the `vehicle_models` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organizationId,departmentId,code]` on the table `stock_items` will be added. If there are existing duplicate values, this will fail.
  - Made the column `code` on table `stock_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `departmentId` on table `stock_items` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SeasonType" AS ENUM ('SUMMER', 'WINTER');

-- CreateEnum
CREATE TYPE "SetKind" AS ENUM ('TIRE', 'WHEEL');

-- CreateEnum
CREATE TYPE "SetStatus" AS ENUM ('STORED', 'IN_USE', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('BATTERY', 'AGGREGATE');

-- CreateEnum
CREATE TYPE "WearMode" AS ENUM ('BY_MILEAGE', 'BY_MONTHS');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('MPN', 'BARCODE', 'INTERNAL', 'OTHER');

-- DropIndex
DROP INDEX "stock_items_organizationId_name_key";

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "avgCost" DECIMAL(14,2),
ADD COLUMN     "brandId" UUID,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "group" TEXT,
ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "departmentId" SET NOT NULL;

-- AlterTable
ALTER TABLE "vehicle_models" DROP COLUMN "manufactureYears",
ADD COLUMN     "manufactureYearFrom" INTEGER,
ADD COLUMN     "manufactureYearTo" INTEGER;

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_item_identifiers" (
    "id" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "brandId" UUID,

    CONSTRAINT "stock_item_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_sets" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "kind" "SetKind" NOT NULL,
    "season" "SeasonType" NOT NULL,
    "spec" TEXT NOT NULL,
    "status" "SetStatus" NOT NULL DEFAULT 'STORED',
    "stockLocationId" UUID,
    "installedAt" TIMESTAMP(6),
    "removedAt" TIMESTAMP(6),
    "installedAtOdometerKm" INTEGER,
    "removedAtOdometerKm" INTEGER,
    "wearPct" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "vehicle_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_assets" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "stockItemId" UUID,
    "serialNo" TEXT,
    "installedAt" TIMESTAMP(6) NOT NULL,
    "installedAtOdometerKm" INTEGER,
    "wearMode" "WearMode" NOT NULL,
    "wearPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "serviceLifeMonths" INTEGER,
    "wearPctPer1000km" DECIMAL(10,4),
    "status" TEXT NOT NULL DEFAULT 'IN_USE',

    CONSTRAINT "vehicle_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_organizationId_name_key" ON "brands"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stock_item_identifiers_type_value_brandId_key" ON "stock_item_identifiers"("type", "value", "brandId");

-- CreateIndex
CREATE INDEX "vehicle_sets_vehicleId_kind_season_status_idx" ON "vehicle_sets"("vehicleId", "kind", "season", "status");

-- CreateIndex
CREATE INDEX "vehicle_assets_vehicleId_kind_status_idx" ON "vehicle_assets"("vehicleId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_organizationId_departmentId_code_key" ON "stock_items"("organizationId", "departmentId", "code");

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_identifiers" ADD CONSTRAINT "stock_item_identifiers_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_sets" ADD CONSTRAINT "vehicle_sets_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_sets" ADD CONSTRAINT "vehicle_sets_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assets" ADD CONSTRAINT "vehicle_assets_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
