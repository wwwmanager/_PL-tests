-- CreateTable
CREATE TABLE "fuel_card_assignments" (
    "id" UUID NOT NULL,
    "fuelCardId" UUID NOT NULL,
    "validFrom" TIMESTAMP(6) NOT NULL,
    "validTo" TIMESTAMP(6),
    "driverId" UUID,
    "vehicleId" UUID,
    "providerName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_card_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuel_card_assignments_fuelCardId_validFrom_validTo_idx" ON "fuel_card_assignments"("fuelCardId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "fuel_card_assignments_driverId_validFrom_validTo_idx" ON "fuel_card_assignments"("driverId", "validFrom", "validTo");

-- AddForeignKey
ALTER TABLE "fuel_card_assignments" ADD CONSTRAINT "fuel_card_assignments_fuelCardId_fkey" FOREIGN KEY ("fuelCardId") REFERENCES "fuel_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_card_assignments" ADD CONSTRAINT "fuel_card_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_card_assignments" ADD CONSTRAINT "fuel_card_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
