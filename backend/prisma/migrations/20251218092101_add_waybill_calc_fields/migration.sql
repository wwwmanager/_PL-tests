-- AlterTable
ALTER TABLE "waybill_fuel" ADD COLUMN     "fuelPlanned" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "waybills" ADD COLUMN     "isCityDriving" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isWarming" BOOLEAN NOT NULL DEFAULT false;
