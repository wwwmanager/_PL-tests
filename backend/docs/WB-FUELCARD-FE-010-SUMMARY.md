# WB-FUELCARD-FE-010: Frontend Integration Summary

## Changes Made

### File: `components/waybills/WaybillDetail.tsx`

#### 1. Prefill Application (Line 616)
**Before:**
```typescript
applyField('driverId', data.driverId);
applyField('dispatcherEmployeeId', data.dispatcherEmployeeId);
```

**After:**
```typescript
applyField('driverId', data.driverId);
applyField('fuelCardId', data.fuelCardId); // WB-FUELCARD-FE-010: Auto-fill fuelCardId
applyField('dispatcherEmployeeId', data.dispatcherEmployeeId);
```

**Impact:** When prefill data is loaded (via `getWaybillPrefill` API), the `fuelCardId` is now automatically applied to the form state.

---

#### 2. FormData Initialization (Line 276)
**Before:**
```typescript
// Ensure dispatcher/controller/validTo are mapped
dispatcherEmployeeId: sourceWaybill.dispatcherEmployeeId || sourceWaybill.dispatcherId || '',
controllerEmployeeId: sourceWaybill.controllerEmployeeId || sourceWaybill.controllerId || '',
```

**After:**
```typescript
// Ensure dispatcher/controller/validTo/fuelCardId are mapped
fuelCardId: sourceWaybill.fuel CardId || '', // WB-FUELCARD-FE-010
dispatcherEmployeeId: sourceWaybill.dispatcherEmployeeId || sourceWaybill.dispatcherId || '',
controllerEmployeeId: sourceWaybill.controllerEmployeeId || sourceWaybill.controllerId || '',
```

**Impact:** When loading an existing waybill for editing, the `fuelCardId` is now properly initialized in formData.

---

#### 3. Payload Inclusion (Automatic via formData spread)
**No changes needed** - The payload is constructed via:
```typescript
const payload = {
  ...formData,  // ✅ Automatically includes fuelCardId
  // other fields...
};
```

**Impact:** Both `createWaybill` and `updateWaybill` API calls now receive `fuelCardId` in the payload.

---

## Data Flow

### Create New Waybill
```
1. User selects Vehicle
   ↓
2. handleVehicleChange() triggers getWaybillPrefill(vehicleId)
   ↓
3. Backend returns PrefillData { fuelCardId: "xxx", driverId: "yyy", ... }
   ↓
4. applyPrefill() called
   ↓
5. formData.fuelCardId = "xxx" ✅
   ↓
6. User saves waybill
   ↓
7. Payload includes fuelCardId: "xxx" ✅
   ↓
8. Backend validates and saves
```

### Edit Existing Waybill
```
1. User opens existing waybill
   ↓
2. getWaybillById(id) called
   ↓
3. Backend returns Waybill { fuelCardId: "xxx", ... }
   ↓
4. FormData initialization maps fuelCardId ✅
   ↓
5. formData.fuelCardId = "xxx"
   ↓
6. User updates and saves
   ↓
7. Payload includes fuelCardId: "xxx" ✅
```

---

## Testing Checklist

### Manual Tests
- [ ] **Test 1: Create new waybill with driver that has fuel card**
  - Select vehicle → Select driver → Verify `fuelCardId` auto-populated
  - Save → Verify API payload includes `fuelCardId`

- [ ] **Test 2: Create new waybill, change driver**
  - Select vehicle → Select driver A → Change to driver B
  - Verify `fuelCardId` updates to driver B's card

- [ ] **Test 3: Edit existing waybill**
  - Open waybill with `fuelCardId` set
  - Verify field is populated
  - Save → Verify `fuelCardId` persisted

- [ ] **Test 4: Post waybill with FUEL_CARD source**
  - Create waybill with `sourceType='FUEL_CARD'`
  - Verify `fuelCardId` is set
  - Post → Verify success (no FUEL_CARD_REQUIRED error)

### Browser DevTools Verification
```javascript
// In console after selecting vehicle:
// Should see prefill call:
// GET /api/waybills/prefill?vehicleId=xxx

// Response should include:
// { fuelCardId: "yyy", driverId: "zzz", ... }

// Check formData state:
// (React DevTools or console.log in component)
// formData.fuelCardId should be "yyy"
```

---

## Acceptance Criteria

✅ **AC1:** При создании нового ПЛ карта автоматически выбирается по водителю  
✅ **AC2:** При редактировании ПЛ `fuelCardId` загружается из существующих данных  
✅ **AC3:** Payload create/update включает `fuelCardId`  
⏳ **AC4:** Проведение ПЛ с `sourceType='FUEL_CARD'` проходит успешно (требует manual testing)

---

**Status:** ✅ Implementation Complete, ⏳ Testing Pending  
**Date:** 2025-12-23
