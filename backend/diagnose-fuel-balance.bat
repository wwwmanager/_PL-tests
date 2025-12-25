@echo off
setlocal
set PGPASSWORD=1234
set PAGER=

echo === STEP 1: Waybill Details ===
psql -U postgres -d waybills -A -t -c "SELECT w.id, w.number, w.date, w.status, w.\"fuelCardId\", w.\"startAt\", fc.\"cardNumber\" FROM waybills w LEFT JOIN fuel_cards fc ON fc.id = w.\"fuelCardId\" WHERE w.id = '859200fc-f5c7-4fb2-b1d9-bb103bac726b';"

echo.
echo === STEP 2: Fuel Lines with Computed occurredAt ===
psql -U postgres -d waybills -A -t -c "SELECT wf.id, wf.\"stockItemId\", si.name, wf.\"fuelReceived\", wf.\"refueledAt\", wf.\"sourceType\", COALESCE(wf.\"refueledAt\", w.\"startAt\", w.date) as transfer_occurred_at FROM waybill_fuel wf JOIN waybills w ON w.id = wf.\"waybillId\" LEFT JOIN stock_items si ON si.id = wf.\"stockItemId\" WHERE wf.\"waybillId\" = '859200fc-f5c7-4fb2-b1d9-bb103bac726b';"

echo.
echo === STEP 3: Fuel Card Location ===
psql -U postgres -d waybills -A -t -c "SELECT sl.id, sl.name, sl.type, sl.\"fuelCardId\", fc.\"cardNumber\" FROM stock_locations sl JOIN fuel_cards fc ON fc.id = sl.\"fuelCardId\" WHERE sl.\"fuelCardId\" = '1df685f1-9adb-4d93-880f-dc1ba9ef7f25' AND sl.type = 'FUEL_CARD';"

echo.
echo === STEP 4: TopUp Movements to This Card ===
psql -U postgres -d waybills -A -t -c "SELECT sm.id, sm.\"occurredAt\", sm.quantity, sm.\"stockItemId\", si.name, sm.\"isVoid\", sm.comment FROM stock_movements sm LEFT JOIN stock_items si ON si.id = sm.\"stockItemId\" WHERE sm.\"toStockLocationId\" IN (SELECT id FROM stock_locations WHERE \"fuelCardId\" = '1df685f1-9adb-4d93-880f-dc1ba9ef7f25') AND sm.\"movementType\" = 'TRANSFER' ORDER BY sm.\"occurredAt\" DESC LIMIT 10;"

echo.
echo === STEP 5: Date Comparison (ROOT CAUSE CHECK) ===
psql -U postgres -d waybills -A -t -c "SELECT 'TopUp' as source, sm.id, sm.\"occurredAt\", sm.quantity, sm.\"stockItemId\" FROM stock_movements sm WHERE sm.\"toStockLocationId\" IN (SELECT id FROM stock_locations WHERE \"fuelCardId\" = '1df685f1-9adb-4d93-880f-dc1ba9ef7f25') AND sm.\"movementType\" = 'TRANSFER' AND sm.\"isVoid\" = false UNION ALL SELECT 'Refuel' as source, wf.id, COALESCE(wf.\"refueledAt\", w.\"startAt\", w.date)::timestamp, wf.\"fuelReceived\", wf.\"stockItemId\" FROM waybill_fuel wf JOIN waybills w ON w.id = wf.\"waybillId\" WHERE wf.\"waybillId\" = '859200fc-f5c7-4fb2-b1d9-bb103bac726b' ORDER BY 3 DESC;"

pause
