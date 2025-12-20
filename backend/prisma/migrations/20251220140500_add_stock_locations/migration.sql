-- CreateEnum
CREATE TYPE "StockLocationType" AS ENUM ('WAREHOUSE', 'FUEL_CARD', 'VEHICLE_TANK');

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "type" "StockLocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "warehouseId" UUID,
    "fuelCardId" UUID,
    "vehicleId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_warehouseId_key" ON "stock_locations"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_fuelCardId_key" ON "stock_locations"("fuelCardId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_vehicleId_key" ON "stock_locations"("vehicleId");

-- CreateIndex
CREATE INDEX "stock_locations_organizationId_type_idx" ON "stock_locations"("organizationId", "type");

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_fuelCardId_fkey" FOREIGN KEY ("fuelCardId") REFERENCES "fuel_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
