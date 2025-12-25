# WB-FUELCARD-MIG-020: Backfill Execution Results

**Дата:** _________________  
**Среда:** ☐ Staging ☐ Production  
**Выполнил:** _________________

---

## Pre-migration Status

**Database:** `waybills` (или `waybills_staging`)

### Count affected waybills:
```sql
SELECT COUNT(*) as need_backfill
FROM waybills w
JOIN waybill_fuel wf ON wf."waybillId" = w.id
WHERE wf."sourceType" = 'FUEL_CARD'
  AND w."fuelCardId" IS NULL;
```

**Result:** `_______` waybills need backfill

---

## Step 1: Backup

**Command:**
```bash
pg_dump -U postgres -d waybills > backup_pre_fuelcard_migration_YYYYMMDD_HHMMSS.sql
```

**Backup file:** `___________________________________________`  
**Size:** `_______` MB  
**Status:** ☐ SUCCESS ☐ FAILED

---

## Step 2: Preview Affected Waybills

**SQL:** (from migration-backfill-fuelcard.sql Step 1)

**Sample Preview (first 5 rows):**
```
id                                  | number      | fuelCardId | driver_fuel_card_id
------------------------------------|-------------|------------|--------------------
___________________________________| ___________| NULL       | ___________________
___________________________________| ___________| NULL       | ___________________
___________________________________| ___________| NULL       | ___________________
```

**Total affected:** `_______` waybills

---

## Step 3: Execute UPDATE

**Command:**
```sql
BEGIN;

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

COMMIT;
```

**UPDATE count:** `_______` rows updated  
**Status:** ☐ SUCCESS ☐ FAILED ☐ ROLLED BACK

---

## Step 4: Verify Updates

**SQL:** (from migration-backfill-fuelcard.sql Step 3)

**Sample verified waybills (first 3):**
```
id                                  | number      | fuelCardId                           | cardNumber
------------------------------------|-------------|--------------------------------------|-------------
___________________________________| ___________| ____________________________________| __________
___________________________________| ___________| ____________________________________| __________
___________________________________| ___________| ____________________________________| __________
```

**Total with fuelCardId after backfill:** `_______` waybills

---

## Step 5: Find Orphans

**SQL:** (from migration-backfill-fuelcard.sql Step 4)

**Orphans count:** `_______` waybills

**Sample orphans (first 3):**
```
id                                  | number      | driverId                             | issue
------------------------------------|-------------|--------------------------------------|---------------------------
___________________________________| ___________| ____________________________________| Driver has no card
___________________________________| ___________| ____________________________________| Driver has no card
___________________________________| ___________| ____________________________________| Driver has no card
```

**Orphan percentage:** `_______`% (orphans / total affected)

---

## Post-Migration Validation

### Spot-check 1: Random updated waybill
```sql
SELECT w.id, w.number, w."fuelCardId", fc."cardNumber", d."employeeId"
FROM waybills w
JOIN drivers d ON d.id = w."driverId"
LEFT JOIN fuel_cards fc ON fc.id = w."fuelCardId"
WHERE w.id = '___________________________________';
```

**Result:**
- Waybill ID: `___________________________________`
- Number: `___________`
- fuelCardId: `___________________________________`
- Card Number: `___________`
- ☐ fuelCardId matches driver's card: ☐ YES ☐ NO

### Spot-check 2: Try to POST updated waybill
- ☐ ПЛ открывается корректно
- ☐ fuelCardId загружен
- ☐ POST проходит или даёт валидную ошибку (не FUEL_CARD_REQUIRED)

---

## Summary

**Total affected waybills:** `_______`  
**Successfully updated:** `_______`  
**Orphans (no card assigned):** `_______`  
**Orphan percentage:** `_______`%

**Backup location:** `_______________________________________`  
**Orphans report saved:** `_______________________________________`

---

## Action Items (for Orphans)

☐ Review orphan list  
☐ For each orphan:
  - ☐ Assign fuel card to driver (if card exists)
  - ☐ OR change sourceType from FUEL_CARD to MANUAL
  - ☐ OR document as "acceptable orphan" (e.g., retired driver)

---

## Decision

☐ **MIGRATION SUCCESS** - Ready for production  
☐ **MIGRATION FAILED** - Rollback required  
☐ **PARTIAL SUCCESS** - Need to address orphans

**Signature:** _________________  
**Date:** _________________
