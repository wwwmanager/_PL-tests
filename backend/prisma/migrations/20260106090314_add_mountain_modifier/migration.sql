-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "useMountainModifier" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "waybill_routes" ADD COLUMN     "isMountainDriving" BOOLEAN;
