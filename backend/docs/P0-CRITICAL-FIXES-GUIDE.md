# QA-BLOCKERS-001: Implementation Status Update

## ✅ GOOD NEWS: 2 out of 3 Critical Blockers Already Fixed!

---

## P0-1: WB-NUM-001 - Waybill Number Format

### Status: ✅ BACKEND FIXED, MIGRATION NEEDED

**Backend (`waybillService.ts`):**
- Line 323 & 331: `formatBlankNumber(blank.series, blank.number)` ✅
- Line 446: Stores formatted number in DB ✅

**Problem:** Existing records may have short format

**Solution:** Run migration script

```bash
cd c:\_PL-tests\backend
psql -U postgres -d waybills -f docs/migration-p0-1-waybill-number-format.sql
```

**Estimated Time:** 5 minutes

---

## P0-2: WB-POSTED-UI-002 - Fields Cleared After POST

### Status: ❌ NEEDS FIX (Frontend)

**Problem:** `WaybillDetail.tsx` line 1186 uses incomplete data after status change

**Fix Location:** `c:\_PL-tests\components\waybills\WaybillDetail.tsx` lines 1180-1191

**Change Required:**
```typescript
// BEFORE (line 1182-1186):
const updatedWaybill = await changeWaybillStatus(savedWaybill.id, frontStatus, {...});
setFormData(updatedWaybill as Waybill);  // ← INCOMPLETE DATA

// AFTER:
await changeWaybillStatus(savedWaybill.id, frontStatus, {...});
const freshWaybill = await getWaybillById(savedWaybill.id);  // ← FULL RELOAD
// ...map fuel fields (see guide)
setFormData(mappedFormData as Waybill);
```

**Full code:** See [`P0-CRITICAL-FIXES-GUIDE.md`](file:///c:/_PL-tests/backend/docs/P0-CRITICAL-FIXES-GUIDE.md) section P0-2

**Estimated Time:** 10 minutes

---

## P0-3: WB-PREFILL-NEXT-003 - Prefill From Last POSTED

### Status: ✅ ALREADY IMPLEMENTED!

**Backend (`waybillService.ts`):**
- Line 1153-1167: Query last POSTED waybill ✅
- Line 1222: `odometerStart = lastWaybill?.odometerEnd ?? vehicle.mileage` ✅
- Line 1225-1243: `fuelStart = tankBalance → lastWaybill.fuelEnd → vehicle.currentFuel` ✅

**Result:** Prefill **ALREADY** uses historical data from last POSTED waybill!

**No changes needed!** ✅

---

## Revised Implementation Plan

### Critical Path (Required for Testing) - 15 minutes

1. **P0-1 Migration** (5 min)
   ```bash
   psql -U postgres -d waybills -f docs/migration-p0-1-waybill-number-format.sql
   ```

2. **P0-2 Frontend Fix** (10 min)
   - Edit `WaybillDetail.tsx` lines 1180-1191
   - Test: Create ПЛ → Add routes → POST → Verify routes still visible

### Verification

After fixes, run manual tests:

**Test P0-1:**
```sql
SELECT id, number FROM waybills WHERE "blankId" IS NOT NULL LIMIT 5;
-- Expected: "ЧБ 000001" format
```

**Test P0-2:**
1. Create waybill with routes/dates
2. Click "Провести" (POST)
3. **Verify:** Routes/dates/fuel preserved ✅

**Test P0-3:**
```
1. POST ПЛ with odometerEnd=15000
2. Create new ПЛ for same vehicle
3. Open prefill data (DevTools)
4. Verify: odometerStart=15000 ✅
```

---

## Summary

| ID | Issue | Status | Time |
|----|-------|--------|------|
| P0-1 | Number format | SQL migration needed | 5 min |
| P0-2 | POSTED UI fields | Code fix needed | 10 min |
| P0-3 | Prefill logic | ✅ Already done | 0 min |

**Total Time:** 15 minutes (not 6 hours!)

---

## Next Steps

1. Run P0-1 migration
2. Apply P0-2 fix (manual edit or provide exact patch)
3. Test all 3 cases
4. Resume fuel card testing (WB-FUELCARD-TEST-010)

---

**Status:** Ready for rapid deployment  
**Updated:** 2025-12-24T16:40
