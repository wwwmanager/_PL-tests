-- AlterTable
ALTER TABLE "fuel_card_topup_rules" ADD COLUMN     "sourceLocationId" UUID,
ADD COLUMN     "stockItemId" UUID;

-- AddForeignKey
ALTER TABLE "fuel_card_topup_rules" ADD CONSTRAINT "fuel_card_topup_rules_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_card_topup_rules" ADD CONSTRAINT "fuel_card_topup_rules_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
