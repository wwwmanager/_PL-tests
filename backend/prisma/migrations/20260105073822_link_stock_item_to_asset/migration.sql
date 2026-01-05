-- AddForeignKey
ALTER TABLE "vehicle_assets" ADD CONSTRAINT "vehicle_assets_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
