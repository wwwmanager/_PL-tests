-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "defaultControllerEmployeeId" UUID,
ADD COLUMN     "defaultDispatcherEmployeeId" UUID;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_defaultDispatcherEmployeeId_fkey" FOREIGN KEY ("defaultDispatcherEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_defaultControllerEmployeeId_fkey" FOREIGN KEY ("defaultControllerEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
