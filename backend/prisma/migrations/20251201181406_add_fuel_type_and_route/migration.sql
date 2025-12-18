-- AlterTable
ALTER TABLE "waybill_fuel" ADD COLUMN     "fuelTypeId" UUID;

-- AlterTable
ALTER TABLE "waybill_routes" ADD COLUMN     "routeId" UUID;

-- CreateTable
CREATE TABLE "fuel_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" TEXT NOT NULL,
    "density" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "fuel_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startPoint" TEXT,
    "endPoint" TEXT,
    "distance" DOUBLE PRECISION,
    "estimatedTime" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fuel_types_code_key" ON "fuel_types"("code");

-- AddForeignKey
ALTER TABLE "waybill_routes" ADD CONSTRAINT "waybill_routes_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waybill_fuel" ADD CONSTRAINT "waybill_fuel_fuelTypeId_fkey" FOREIGN KEY ("fuelTypeId") REFERENCES "fuel_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
