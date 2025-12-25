# P0 Blockers: Code Factsheet

Детальная фактура для реализации оставшихся P0-блокеров.

---

## P0-2: WB-POSTED-UI-002 - Fields Cleared After POST

### ✅ Analysis Complete

**Problem:** After POSTED, UI clears routes, dates, fuel  
**Root Cause:** `handleStatusChange` uses incomplete response from `changeWaybillStatus`

**Location:**  
- File: `c:\_PL-tests\components\waybills\WaybillDetail.tsx`  
- Function: `handleStatusChange` (lines 1168-1192)  
- Issue: Line 1186 `setFormData(updatedWaybill as Waybill)` - incomplete data

**Fix:** Reload full waybill via `getWaybillById` (already imported on line 5)  
**Patch file:** `p0-2-waybilldetail-patch.tsx` ✅

---

## P0-5: UX-DOC-GUARD-005 - Navigation Guard

### Current Behavior Analysis

**File:** `c:\_PL-tests\components\waybills\WaybillDetail.tsx`

#### 1. Close Logic (lines 1077-1088):

```typescript
const handleCloseRequest = () => {
  if (isDirty) {
    setIsConfirmationModalOpen(true);  // ✅ Shows modal
  } else {
    onClose();  // ❌ Silent close without saving
  }
};

const handleConfirmClose = () => {
  setIsConfirmationModalOpen(false);
  onClose();  // ❌ Closes WITHOUT saving
};
```

**Current State:**
- ✅ Has dirty check
- ✅ Shows confirmation modal
- ❌ **NO "Save & Close" option** - only "Закрыть без сохранения"
- ❌ Navigating away (clicking menu) does NOT trigger guard

#### 2. Parent Call Stack:

**File:** `c:\_PL-tests\components\waybills\WaybillList.tsx`

```typescript
const handleCloseDetail = () => {
  setIsDetailViewOpen(false);  // Removes component from DOM
  setSelectedWaybillId(null);
  setWaybillToPrefill(null);
  fetchData();  // Refetch list
};
```

**Issue:** When user clicks navigation menu:
- `WaybillList` unmounts → `WaybillDetail` unmounts
- No guard triggered, data lost silently

---

### P0-5 Fix Requirements:

#### Option A: Router-level guard (If using React Router)

```typescript
// Install: npm install react-router-dom
import { useBlocker } from 'react-router-dom';

// Inside WaybillDetail:
useBlocker(() => isDirty);
```

#### Option B: useBeforeUnload + Custom Nav Guard

```typescript
// In WaybillDetail.tsx:
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';  // Browser shows confirmation
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isDirty]);
```

**For menu navigation:** Need global router integration or parent component guard

#### Fix Confirmation Modal (lines 1262-1266):

**Current:**
```typescript
<ConfirmationModal
  isOpen={isConfirmationModalOpen}
  onClose={() => setIsConfirmationModalOpen(false)}
  onConfirm={handleConfirmClose}  // ← Only closes
  title="Закрыть без сохранения?"
  message="Несохранённые изменения будут потеряны."
/>
```

**Fixed:**
```typescript
<ConfirmationModal
  isOpen={isConfirmationModalOpen}
  onClose={() => setIsConfirmationModalOpen(false)}
  onConfirm={async () => {
    // NEW: Save before close
    const saved = await handleSave(true);
    if (saved) {
      setIsConfirmationModalOpen(false);
      onClose();
    }
  }}
  title="Сохранить изменения?"
  message="Хотите сохранить изменения перед закрытием?"
  confirmText="Сохранить и закрыть"
  // Add "Закрыть без сохранения" as secondary action
  secondaryAction={{
    text: "Закрыть без сохранения",
    onClick: handleConfirmClose
  }}
/>
```

**Locations to Change:**
- Line 1077-1083: `handleCloseRequest` logic
- Line 1262-1266: Modal props
- Line 1228-1232: Add "Save & Close" button? (Optional)

---

## P0-6: BSO-RETURN-006 - Blank Return on Deletion

### Current Delete Flow Analysis

**Backend Service:** `c:\_PL-tests\backend\src\services\waybillService.ts`  
**Function:** `deleteWaybill` (lines 748-795)

#### Current Logic:

```typescript
export async function deleteWaybill(userInfo: UserInfo, id: string) {
  const waybill = await prisma.waybill.findFirst({
    where: { id, organizationId },
    include: { blank: true }
  });
  
  // WB-DEL-001: Release blank when deleting
  if (waybill.blankId && waybill.blank) {
    const blankStatus = waybill.blank.status;
    
    if (blankStatus === BlankStatus.RESERVED) {
      await releaseBlank(organizationId, waybill.blankId);  // ✅ Returns to ISSUED
    } else {
      console.log('Blank not in RESERVED status');  // ❌ No action for USED status
    }
  }
  
  return prisma.waybill.delete({ where: { id } });
}
```

**Issue:** If waybill is POSTED, blank status is **USED**, not **RESERVED**  
→ `releaseBlank()` is NOT called  
→ Blank remains USED after deletion

---

### P0-6 Fix Options:

**Schema Change Needed:**
```prisma
enum WaybillStatus {
  DRAFT
  SUBMITTED
  POSTED
  CANCELLED  // NEW
  VOIDED     // NEW (for deleted POSTED)
}
```

#### Option A: Add CANCELLED status (Soft Delete)

```typescript
export async function cancelWaybill(userInfo: UserInfo, id: string) {
  const waybill = await prisma.waybill.findFirst({
    where: { id, organizationId, status: WaybillStatus.POSTED },
    include: { blank: true, fuel: true }
  });
  
  if (!waybill) throw new Error('Only POSTED waybills can be cancelled');
  
  return await prisma.$transaction(async (tx) => {
    // 1. Void fuel movements (create reversing entries)
    for (const fuelLine of waybill.fuel) {
      if (fuelLine.sourceType === 'FUEL_CARD') {
        await tx.stockMovement.create({
          data: {
            type: 'ADJUSTMENT',
            quantity: -fuelLine.quantity,  // Reverse
            documentType: 'WAYBILL_VOID',
            documentId: waybill.id,
            externalRef: `VOID:${waybill.number}`,
            stockItemId: fuelLine.stockItemId,
            // ... other fields
          }
        });
      }
    }
    
    // 2. Return blank to pool
    await tx.blank.update({
      where: { id: waybill.blankId },
      data: { status: BlankStatus.ISSUED }  // or AVAILABLE
    });
    
    // 3. Mark waybill as cancelled
    await tx.waybill.update({
      where: { id: waybill.id },
      data: { status: WaybillStatus.CANCELLED }
    });
    
    // 4. Audit log
    // ...
  });
}
```

#### Option B: Prevent POSTED Deletion

```typescript
export async function deleteWaybill(userInfo: UserInfo, id: string) {
  const waybill = await prisma.waybill.findFirst({...});
  
  // Add check
  if (waybill.status === WaybillStatus.POSTED) {
    throw new BadRequestError('Нельзя удалить проведённый путевой лист. Используйте отмену проводки.');
  }
  
  // Existing logic...
}
```

**Recommended:** Option A (CANCELLED status) - preserves audit trail

**Files to Change:**
1. `backend/prisma/schema.prisma` - Add CANCELLED to enum
2. `backend/src/services/waybillService.ts` - Add `cancelWaybill` function
3. `backend/src/controllers/waybillController.ts` - Add cancel endpoint
4. Frontend: Update status translations

---

## P0-7: STOCK-INCOME-SUPPLIER-007 - Supplier Field

### Current Form Analysis

**File:** `c:\_PL-tests\components\warehouse\MovementCreateModal.tsx`

#### Current Schema (lines 10-18):

```typescript
const movementSchema = z.object({
  occurredAt: z.string().min(1, 'Укажите дату и время'),
  movementType: z.enum(['INCOME', 'TRANSFER', 'EXPENSE', 'ADJUSTMENT']),
  stockItemId: z.string().min(1, 'Выберите товар'),
  quantity: z.preprocess((val) => Number(val), z.number()),
  fromStockLocationId: z.string().optional(),
  toStockLocationId: z.string().optional(),
  comment: z.string().optional(),
  externalRef: z.string().optional(),  // ← Currently used for "Внешний номер"
});
```

#### Current Payload (lines 141-158):

```typescript
const payload: any = {
  ...data,
  occurredAt: new Date(data.occurredAt).toISOString(),
};

if (data.movementType === 'INCOME') {
  payload.stockLocationId = data.toStockLocationId;  // Warehouse location
  payload.fromStockLocationId = undefined;
  payload.toStockLocationId = undefined;
}
// externalRef is passed as-is
```

**Backend:** Accepts `externalRef` field (already in schema, line 18 of schema definition)

---

### P0-7 Fix (Quick Version):

#### Option A: Use externalRef for supplier (NO schema change)

**UI Change:** Line 290-296

**Current:**
```typescript
<label>Внешний номер (Ref)</label>
<input
  {...register('externalRef')}
  placeholder="Напр. номер накладной"
/>
```

**Fixed (INCOME only):**
```typescript
<label>
  {movementType === 'INCOME' ? 'Поставщик / Документ' : 'Внешний номер'}
</label>
<input
  {...register('externalRef')}
  placeholder={movementType === 'INCOME' 
    ? "Например: ООО Ромашка, накл. №12345" 
    : "Напр. номер накладной"}
/>
```

**No backend changes needed** - `externalRef` already stored in DB

#### Option B: Add Supplier entity (Full solution - P1)

1. Create `Supplier` model in Prisma
2. Add `supplierId` to `StockMovement`
3. Create supplier CRUD API
4. Update form with supplier dropdown

**Recommendation:** Option A for P0, Option B for future enhancement

**Files to Change:**
1. `components/warehouse/MovementCreateModal.tsx` - Update label logic (lines 289-296)

---

## Backend GET /waybills/:id Include Analysis

**Service:** `c:\_PL-tests\backend\src\services\waybillService.ts`  
**Function:** `getWaybillById` (lines 175-238)

### Current Include:

```typescript
const waybill = await prisma.waybill.findFirst({
  where: { id, organizationId },
  include: {
    vehicle: true,
    driver: { include: { employee: true } },
    blank: true,
    fuelLines: true,         // ✅ ALWAYS included
    routes: true,            // ✅ ALWAYS included
    dispatcherEmployee: true,
    controllerEmployee: true
  }
});
```

**Answer:** ✅ Routes and fuel **ALWAYS** included in GET response

---

## Summary Table

| ID | Issue | File | Lines | Fix Complexity |
|----|-------|------|-------|----------------|
| P0-2 | POSTED UI fields | WaybillDetail.tsx | 1180-1191 | ✅ Easy (patch ready) |
| P0-5 | Navigation guard | WaybillDetail.tsx | 1077-1088, 1262-1266 | 🟡 Medium (useBeforeUnload) |
| P0-6 | Blank return | waybillService.ts | 748-795 + schema | 🔴 Hard (schema change) |
| P0-7 | Supplier field | MovementCreateModal.tsx | 289-296 | ✅ Easy (label change) |

**Quick Wins:** P0-2 (10 min) + P0-7 (5 min) = **15 minutes**  
**Medium Effort:** P0-5 (30 min)  
**Complex:** P0-6 (2 hours - needs schema migration)

---

## Execution Priority

### Phase 1: Critical Path (15 min)
1. ✅ P0-1: Run SQL migration
2. ✅ P0-2: Apply WaybillDetail patch
3. ✅ P0-7: Update supplier label

### Phase 2: UX Enhancement (30 min)
4. P0-5: Add navigation guard

### Phase 3: Architectural (Defer to P1?)
5. P0-6: CANCELLED status + cancel flow

**Recommendation:** Do Phase 1 + Phase 2, defer P0-6 to separate ticket (requires schema change + migration)

---

**Created:** 2025-12-24T16:42  
**Status:** Ready for implementation
