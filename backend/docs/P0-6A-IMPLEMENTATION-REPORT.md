# P0-6A Implementation Report: POSTED Deletion Block

**Date:** 2025-12-24  
**Duration:** 5 minutes  
**Status:** ✅ COMPLETE

---

## Problem

**P0-6 Full Issue:** Deleting a POSTED waybill doesn't correctly handle:
- Blank status (remains USED instead of returning to pool)
- Stock movements (fuel card top-ups not voided)
- Audit trail (hard deletion destroys history)

**Immediate Risk:** Users can delete POSTED waybills, causing data corruption

---

## Solution: Safety-Net (Temporary)

Block deletion of POSTED waybills until full CANCELLED workflow is implemented.

---

## Changes Made

**File:** `c:\_PL-tests\backend\src\services\waybillService.ts`  
**Function:** `deleteWaybill` (lines 767-772)

**Added Check:**
```typescript
// P0-6A: BSO-DELETE-POSTED-BLOCK - Safety-net
if (waybill.status === WaybillStatus.POSTED) {
    throw new BadRequestError('Нельзя удалить проведённый ПЛ. Используйте Отменить.');
}
```

**Location:** After waybill is fetched, before blank release logic

---

## How It Works

### Before (DANGEROUS):
1. User clicks "Delete" on POSTED waybill
2. Backend tries to release blank (fails - blank is USED, not RESERVED)
3. Waybill deleted anyway
4. **Result:** 💥 Broken data - blank stuck as USED, fuel movements orphaned

### After (SAFE):
1. User clicks "Delete" on POSTED waybill
2. Backend checks: `status === POSTED`?
3. **Returns 400 error:** "Нельзя удалить проведённый ПЛ. Используйте Отменить."
4. **Result:** ✅ Data protected, user informed

---

## Testing

### Manual Test:

```bash
# 1. Create and POST a waybill via UI
# 2. Try to delete it
# Expected: Error message in UI
```

### API Test:

```bash
# Get a POSTED waybill ID
psql -U postgres -d waybills -c "SELECT id FROM waybills WHERE status = 'POSTED' LIMIT 1;"

# Try to delete via API (replace {id})
curl -X DELETE http://localhost:3001/api/waybills/{id} \
  -H "Authorization: Bearer {token}"

# Expected Response:
# 400 Bad Request
# {"error": "Нельзя удалить проведённый ПЛ. Используйте Отменить."}
```

### Can Still Delete:
- ✅ DRAFT waybills
- ✅ SUBMITTED waybills (if permitted)

### Cannot Delete:
- ❌ POSTED waybills → Error message

---

## Acceptance Criteria

- [x] ✅ **Нельзя удалить POSTED** - 400 error returned
- [x] ✅ **БСО/склад защищены** - prevents blank/stock corruption
- [x] ✅ **Понятное сообщение** - "Используйте Отменить"

---

## Future Work (P0-6 Full Implementation)

This is a **temporary safety-net**. Full solution requires:

1. **Add CANCELLED status to schema:**
   ```prisma
   enum WaybillStatus {
     DRAFT
     SUBMITTED
     POSTED
     CANCELLED  // NEW
   }
   ```

2. **Implement `cancelWaybill` function:**
   - Void stock movements (create reversing entries)
   - Return blank to pool (USED → ISSUED)
   - Update waybill status to CANCELLED
   - Create audit log entry

3. **Add frontend "Отменить" button:**
   - Only shown for POSTED waybills
   - Calls `/api/waybills/{id}/cancel` endpoint
   - Shows confirmation modal

4. **Enable soft delete instead of hard delete**

**Timeline:** P1 (post-MVP, ~2 hours)

---

## Migration Path

**Current:** DELETE blocked for POSTED → Safe but limited  
**Future:** DELETE blocked, CANCEL available → Safe and flexible

**No breaking changes** - current code will work with future CANCEL implementation

---

## Files Changed

1. `backend/src/services/waybillService.ts`
   - Lines 767-772: Added POSTED deletion block

---

**Implementation Time:** 5 minutes  
**Test Time:** 2 minutes  
**Total:** 7 minutes

**Status:** ✅ PRODUCTION READY

---

**Created:** 2025-12-24T17:01  
**Implemented by:** AI Agent  
**Phase:** P0-6A (Safety-net)
