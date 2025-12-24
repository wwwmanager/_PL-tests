-- WB-FUELCARD-PREFILL-001: Data Migration Script
-- Backfill fuelCardId for existing waybills with sourceType='FUEL_CARD'
-- RUN THIS BEFORE DEPLOYING NEW CODE WITH POSTED VALIDATION

-- Step 1: Preview affected waybills
SELECT 
    w.id,
    w.number,
    w.date,
    w."driverId",
    w."fuelCardId" as current_fuel_card_id,
    fc.id as driver_fuel_card_id,
    fc."cardNumber",
    wf."sourceType"
FROM waybills w
JOIN waybill_fuel wf ON wf."waybillId" = w.id
LEFT JOIN fuel_cards fc ON fc."assignedToDriverId" = w."driverId" 
    AND fc."isActive" = true 
    AND fc."organizationId" = w."organizationId"
WHERE wf."sourceType" = 'FUEL_CARD'
  AND w."fuelCardId" IS NULL
ORDER BY w.date DESC;

-- Step 2: Update waybills (DRY RUN - uncomment to execute)
-- BEGIN;

UPDATE waybills w
SET "fuelCardId" = (
    SELECT fc.id
    FROM fuel_cards fc
    WHERE fc."assignedToDriverId" = w."driverId"
      AND fc."isActive" = true
      AND fc."organizationId" = w."organizationId"
    ORDER BY fc."cardNumber" ASC
    LIMIT 1
)
WHERE w.id IN (
    SELECT DISTINCT wf."waybillId"
    FROM waybill_fuel wf
    WHERE wf."sourceType" = 'FUEL_CARD'
)
  AND w."fuelCardId" IS NULL;

-- Step 3: Verify updates
SELECT 
    w.id,
    w.number,
    w."fuelCardId",
    fc."cardNumber"
FROM waybills w
JOIN waybill_fuel wf ON wf."waybillId" = w.id
LEFT JOIN fuel_cards fc ON fc.id = w."fuelCardId"
WHERE wf."sourceType" = 'FUEL_CARD'
ORDER BY w.date DESC
LIMIT 20;

-- COMMIT;

-- Step 4: Find waybills that STILL have no fuelCardId (orphans)
SELECT 
    w.id,
    w.number,
    w.date,
    w."driverId",
    d."employeeId",
    'Driver has no assigned fuel card' as issue
FROM waybills w
JOIN waybill_fuel wf ON wf."waybillId" = w.id
JOIN drivers d ON d.id = w."driverId"
LEFT JOIN fuel_cards fc ON fc."assignedToDriverId" = w."driverId" AND fc."isActive" = true
WHERE wf."sourceType" = 'FUEL_CARD'
  AND w."fuelCardId" IS NULL
  AND fc.id IS NULL;

-- These waybills will FAIL to POST after deployment
-- Manual intervention required: either assign fuel card or change sourceType
