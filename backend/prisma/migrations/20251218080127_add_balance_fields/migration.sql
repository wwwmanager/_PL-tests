-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "balance" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "currentFuel" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "mileage" DECIMAL(10,1) NOT NULL DEFAULT 0;
