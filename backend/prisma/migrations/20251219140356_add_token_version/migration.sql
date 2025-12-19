/*
  Warnings:

  - A unique constraint covering the columns `[registrationNumber]` on the table `vehicles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FuelCalculationMethod" AS ENUM ('BOILER', 'MIXED', 'SEGMENTS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "assignedDriverId" UUID,
ADD COLUMN     "diagnosticCardExpiryDate" TEXT,
ADD COLUMN     "diagnosticCardIssueDate" TEXT,
ADD COLUMN     "diagnosticCardNumber" TEXT,
ADD COLUMN     "disableFuelCapacityCheck" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eptsNumber" TEXT,
ADD COLUMN     "fuelTypeId" UUID,
ADD COLUMN     "maintenanceHistory" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "osagoEndDate" TEXT,
ADD COLUMN     "osagoNumber" TEXT,
ADD COLUMN     "osagoSeries" TEXT,
ADD COLUMN     "osagoStartDate" TEXT,
ADD COLUMN     "ptsNumber" TEXT,
ADD COLUMN     "ptsSeries" TEXT,
ADD COLUMN     "ptsType" TEXT,
ADD COLUMN     "storageLocationId" UUID,
ADD COLUMN     "useCityModifier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "useWarmingModifier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vehicleType" TEXT,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "waybill_routes" ADD COLUMN     "isCityDriving" BOOLEAN,
ADD COLUMN     "isWarming" BOOLEAN;

-- AlterTable
ALTER TABLE "waybills" ADD COLUMN     "fuelCalculationMethod" "FuelCalculationMethod" NOT NULL DEFAULT 'BOILER';

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registrationNumber_key" ON "vehicles"("registrationNumber");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_fuelTypeId_fkey" FOREIGN KEY ("fuelTypeId") REFERENCES "fuel_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
