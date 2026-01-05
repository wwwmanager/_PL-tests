-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "vehicleModelId" UUID;

-- CreateTable
CREATE TABLE "vehicle_models" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fuelStockItemId" UUID,
    "tankCapacity" DECIMAL(10,2),
    "summerRate" DECIMAL(10,2),
    "winterRate" DECIMAL(10,2),
    "tireSize" TEXT,
    "rimSize" TEXT,
    "manufactureYears" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicleModelId_fkey" FOREIGN KEY ("vehicleModelId") REFERENCES "vehicle_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_fuelStockItemId_fkey" FOREIGN KEY ("fuelStockItemId") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
