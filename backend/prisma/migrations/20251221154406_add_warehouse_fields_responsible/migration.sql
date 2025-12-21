-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "description" TEXT,
ADD COLUMN     "responsibleEmployeeId" UUID,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "waybills" ADD COLUMN     "controllerEmployeeId" UUID,
ADD COLUMN     "dispatcherEmployeeId" UUID,
ADD COLUMN     "validTo" TIMESTAMP(6);

-- CreateIndex
CREATE INDEX "warehouses_organizationId_responsibleEmployeeId_idx" ON "warehouses"("organizationId", "responsibleEmployeeId");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waybills" ADD CONSTRAINT "waybills_dispatcherEmployeeId_fkey" FOREIGN KEY ("dispatcherEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waybills" ADD CONSTRAINT "waybills_controllerEmployeeId_fkey" FOREIGN KEY ("controllerEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
