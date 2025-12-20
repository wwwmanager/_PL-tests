-- AlterTable
ALTER TABLE "waybill_fuel" ADD COLUMN     "refueledAt" TIMESTAMP(6),
ADD COLUMN     "sourceType" TEXT;

-- AlterTable
ALTER TABLE "waybills" ADD COLUMN     "endAt" TIMESTAMP(6),
ADD COLUMN     "startAt" TIMESTAMP(6);
