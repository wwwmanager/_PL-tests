-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "defaultWarehouseId" UUID;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
