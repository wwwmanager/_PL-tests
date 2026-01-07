-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "lastMaintenanceMileage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maintenanceIntervalKm" INTEGER NOT NULL DEFAULT 10000;
