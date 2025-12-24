-- Fix Script for Waybill ЧБ 000001
-- Execute these in order after reviewing

-- FIX #1: Add fuelCardId to waybill
UPDATE waybills
SET "fuelCardId" = '1df685f1-9adb-4d93-880f-dc1ba9ef7f25'
WHERE id = '859200fc-f5c7-4fb2-b1d9-bb103bac726b';

-- FIX #2: Set sourceType for fuel line
UPDATE waybill_fuel
SET "sourceType" = 'FUEL_CARD'
WHERE id = 'c36207ec-c29c-4ed6-b416-e275fbf0fd5f';

-- FIX #3 (OPTIONAL): Backdate topup if chronologically correct
-- Only do this if topup ACTUALLY happened before refuel!
-- UPDATE stock_movements
-- SET "occurredAt" = '2025-12-01 00:00:00'::timestamp
-- WHERE id = 'adfaff25-a18a-432c-95dc-1973b8629566';

-- VERIFY: Check updated values
SELECT 
    w.number,
    w."fuelCardId",
    wf."sourceType",
    wf."fuelReceived"
FROM waybills w
JOIN waybill_fuel wf ON wf."waybillId" = w.id
WHERE w.id = '859200fc-f5c7-4fb2-b1d9-bb103bac726b';

-- RETRY POSTING (optional - reset to DRAFT first):
-- UPDATE waybills
-- SET status = 'DRAFT'
-- WHERE id = '859200fc-f5c7-4fb2-b1d9-bb103bac726b';
-- Then use API: PATCH /api/waybills/:id/status { "status": "POSTED" }
