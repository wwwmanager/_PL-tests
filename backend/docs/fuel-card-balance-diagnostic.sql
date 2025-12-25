-- FUEL-CARD-BALANCE-POST-001: Diagnostic SQL Queries
-- Use these queries to investigate "insufficient fuel" error during waybill posting

-- ============================================
-- STEP 1: Find the problematic Waybill
-- ============================================
-- Replace <WAYBILL_ID> with actual ID or search by number/date
SELECT 
    w.id,
    w.number,
    w.date,
    w.status,
    w."vehicleId",
    w."fuelCardId",
    fc."cardNumber" as fuel_card_number
FROM "Waybill" w
LEFT JOIN "FuelCard" fc ON fc.id = w."fuelCardId"
WHERE w.id = '<WAYBILL_ID>' -- or w.number = 'ЧБ 000001'
   OR w.date >= '2025-12-20'::date
ORDER BY w.date DESC, w."createdAt" DESC
LIMIT 10;

-- ============================================
-- STEP 2: Get Fuel Lines with refueledAt
-- ============================================
SELECT 
    wf.id as fuel_line_id,
    wf."waybillId",
    wf."stockItemId",
    si.name as stock_item_name,
    wf."fuelReceived",
    wf."refueledAt",
    wf."sourceType",
    w."startAt",
    w.date as waybill_date,
    -- Computed occurredAt for TRANSFER (same logic as code)
    COALESCE(wf."refueledAt", w."startAt", w.date) as transfer_occurred_at
FROM "WaybillFuel" wf
JOIN "Waybill" w ON w.id = wf."waybillId"
LEFT JOIN "StockItem" si ON si.id = wf."stockItemId"
WHERE wf."waybillId" = '<WAYBILL_ID>'
ORDER BY wf."refueledAt" DESC NULLS LAST;

-- ============================================
-- STEP 3: Get Fuel Card Location
-- ============================================
SELECT 
    sl.id as location_id,
    sl.name as location_name,
    sl.type,
    sl."fuelCardId",
    fc."cardNumber",
    sl."organizationId"
FROM "StockLocation" sl
JOIN "FuelCard" fc ON fc.id = sl."fuelCardId"
WHERE sl."fuelCardId" = '<FUEL_CARD_ID>'
   AND sl.type = 'FUEL_CARD';

-- ============================================
-- STEP 4: Find TopUp Movements for this card
-- ============================================
SELECT 
    sm.id as movement_id,
    sm."movementType",
    sm."occurredAt",
    sm.quantity,
    sm."stockItemId",
    si.name as stock_item_name,
    sm."toStockLocationId",
    sm."fromStockLocationId",
    sm."isVoid",
    sm.comment,
    sm."externalRef"
FROM "StockMovement" sm
LEFT JOIN "StockItem" si ON si.id = sm."stockItemId"
WHERE sm."toStockLocationId" IN (
    SELECT id FROM "StockLocation" WHERE "fuelCardId" = '<FUEL_CARD_ID>'
)
  AND sm."movementType" = 'TRANSFER'
  AND sm."isVoid" = false
ORDER BY sm."occurredAt" DESC
LIMIT 20;

-- ============================================
-- STEP 5: Check Balance at Specific Date
-- ============================================
-- Replace <LOCATION_ID>, <STOCK_ITEM_ID>, <AS_OF_DATE>
WITH movements AS (
    SELECT 
        'INCOME' as type,
        COALESCE(SUM(quantity), 0) as total
    FROM "StockMovement"
    WHERE "stockLocationId" = '<LOCATION_ID>'
      AND "stockItemId" = '<STOCK_ITEM_ID>'
      AND "movementType" = 'INCOME'
      AND "isVoid" = false
      AND "occurredAt" <= '<AS_OF_DATE>'::timestamp
    
    UNION ALL
    
    SELECT 
        'EXPENSE' as type,
        COALESCE(SUM(quantity), 0) as total
    FROM "StockMovement"
    WHERE "stockLocationId" = '<LOCATION_ID>'
      AND "stockItemId" = '<STOCK_ITEM_ID>'
      AND "movementType" = 'EXPENSE'
      AND "isVoid" = false
      AND "occurredAt" <= '<AS_OF_DATE>'::timestamp
    
    UNION ALL
    
    SELECT 
        'ADJUSTMENT' as type,
        COALESCE(SUM(quantity), 0) as total
    FROM "StockMovement"
    WHERE "stockLocationId" = '<LOCATION_ID>'
      AND "stockItemId" = '<STOCK_ITEM_ID>'
      AND "movementType" = 'ADJUSTMENT'
      AND "isVoid" = false
      AND "occurredAt" <= '<AS_OF_DATE>'::timestamp
    
    UNION ALL
    
    SELECT 
        'TRANSFER_IN' as type,
        COALESCE(SUM(quantity), 0) as total
    FROM "StockMovement"
    WHERE "toStockLocationId" = '<LOCATION_ID>'
      AND "stockItemId" = '<STOCK_ITEM_ID>'
      AND "movementType" = 'TRANSFER'
      AND "isVoid" = false
      AND "occurredAt" <= '<AS_OF_DATE>'::timestamp
    
    UNION ALL
    
    SELECT 
        'TRANSFER_OUT' as type,
        COALESCE(SUM(quantity), 0) as total
    FROM "StockMovement"
    WHERE "fromStockLocationId" = '<LOCATION_ID>'
      AND "stockItemId" = '<STOCK_ITEM_ID>'
      AND "movementType" = 'TRANSFER'
      AND "isVoid" = false
      AND "occurredAt" <= '<AS_OF_DATE>'::timestamp
)
SELECT 
    type,
    total,
    -- Running balance calculation
    SUM(CASE 
        WHEN type IN ('INCOME', 'ADJUSTMENT', 'TRANSFER_IN') THEN total
        WHEN type IN ('EXPENSE', 'TRANSFER_OUT') THEN -total
        ELSE 0
    END) OVER () as final_balance
FROM movements;

-- ============================================
-- STEP 6: Compare Dates - ROOT CAUSE CHECK
-- ============================================
-- This query shows if topup happened AFTER refuel
SELECT 
    'TopUp Movement' as source,
    sm.id,
    sm."occurredAt" as occurred_at,
    sm.quantity,
    sm."stockItemId"
FROM "StockMovement" sm
WHERE sm."toStockLocationId" IN (
    SELECT id FROM "StockLocation" WHERE "fuelCardId" = '<FUEL_CARD_ID>'
)
  AND sm."movementType" = 'TRANSFER'
  AND sm."isVoid" = false

UNION ALL

SELECT 
    'Waybill Refuel' as source,
    wf.id,
    COALESCE(wf."refueledAt", w."startAt", w.date) as occurred_at,
    wf."fuelReceived" as quantity,
    wf."stockItemId"
FROM "WaybillFuel" wf
JOIN "Waybill" w ON w.id = wf."waybillId"
WHERE wf."waybillId" = '<WAYBILL_ID>'

ORDER BY occurred_at DESC;

-- ============================================
-- STEP 7: Check for Location Mismatch
-- ============================================
-- Ensure topup goes to the SAME location as waybill expects
SELECT 
    'Expected Card Location' as type,
    sl.id,
    sl.name,
    sl."fuelCardId",
    fc."cardNumber"
FROM "Waybill" w
JOIN "FuelCard" fc ON fc.id = w."fuelCardId"
LEFT JOIN "StockLocation" sl ON sl."fuelCardId" = fc.id AND sl.type = 'FUEL_CARD'
WHERE w.id = '<WAYBILL_ID>'

UNION ALL

SELECT 
    'TopUp Destination' as type,
    sl.id,
    sl.name,
    sl."fuelCardId",
    fc."cardNumber"
FROM "StockMovement" sm
JOIN "StockLocation" sl ON sl.id = sm."toStockLocationId"
LEFT JOIN "FuelCard" fc ON fc.id = sl."fuelCardId"
WHERE sm."toStockLocationId" IN (
    SELECT id FROM "StockLocation" WHERE "fuelCardId" = '<FUEL_CARD_ID>'
)
  AND sm."movementType" = 'TRANSFER'
  AND sm."isVoid" = false
ORDER BY type DESC
LIMIT 10;

-- ============================================
-- STEP 8: Full Timeline View (for debugging)
-- ============================================
SELECT 
    sm.id,
    sm."occurredAt",
    sm."movementType",
    sm.quantity,
    CASE 
        WHEN sm."movementType" = 'INCOME' AND sm."stockLocationId" = '<LOCATION_ID>' THEN quantity
        WHEN sm."movementType" = 'TRANSFER' AND sm."toStockLocationId" = '<LOCATION_ID>' THEN quantity
        WHEN sm."movementType" = 'EXPENSE' AND sm."stockLocationId" = '<LOCATION_ID>' THEN -quantity
        WHEN sm."movementType" = 'TRANSFER' AND sm."fromStockLocationId" = '<LOCATION_ID>' THEN -quantity
        WHEN sm."movementType" = 'ADJUSTMENT' AND sm."stockLocationId" = '<LOCATION_ID>' THEN quantity
        ELSE 0
    END as balance_delta,
    SUM(CASE 
        WHEN sm."movementType" = 'INCOME' AND sm."stockLocationId" = '<LOCATION_ID>' THEN quantity
        WHEN sm."movementType" = 'TRANSFER' AND sm."toStockLocationId" = '<LOCATION_ID>' THEN quantity
        WHEN sm."movementType" = 'EXPENSE' AND sm."stockLocationId" = '<LOCATION_ID>' THEN -quantity
        WHEN sm."movementType" = 'TRANSFER' AND sm."fromStockLocationId" = '<LOCATION_ID>' THEN -quantity
        WHEN sm."movementType" = 'ADJUSTMENT' AND sm."stockLocationId" = '<LOCATION_ID>' THEN quantity
        ELSE 0
    END) OVER (ORDER BY sm."occurredAt", sm."createdAt") as running_balance,
    sm."isVoid",
    sm."documentType",
    sm.comment
FROM "StockMovement" sm
WHERE (sm."stockLocationId" = '<LOCATION_ID>' 
    OR sm."toStockLocationId" = '<LOCATION_ID>' 
    OR sm."fromStockLocationId" = '<LOCATION_ID>')
  AND sm."stockItemId" = '<STOCK_ITEM_ID>'
  AND sm."isVoid" = false
ORDER BY sm."occurredAt" ASC, sm."createdAt" ASC;
