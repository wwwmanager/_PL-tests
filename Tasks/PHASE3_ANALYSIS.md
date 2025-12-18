# Phase 3: Configure Modes - Analysis

## Current State Analysis

### 1. **AppMode Storage** ✅ FOUND

**Location:** IndexedDB via `mockApi.ts:1599`
```typescript
export const getAppSettings = async (): Promise<AppSettings> => {
  await initFromStorage();
  return (await loadJSON(DB_KEYS.APP_SETTINGS, {
    isParserEnabled: true,
    blanks: { driverCanAddBatches: false }
  }));
};
```

**Type Definition:** `types.ts:340-348`
```typescript
export interface AppSettings {
  isParserEnabled: boolean;
  enableWarehouseAccounting?: boolean;
  defaultStorageType?: StorageType;
  appMode?: AppMode; // 'driver' | 'central' (по умолчанию — 'driver')
  blanks?: {
    driverCanAddBatches: boolean;
  };
}
```

---

### 2. **Current Usage of appMode**

#### A. **Authentication (`auth.tsx:164-177`)** ✅
```typescript
const settings = await getAppSettings().catch(() => null);
const isCentralMode = settings?.appMode === 'central';

if (import.meta.env.DEV && !isCentralMode) {
  // DEV autologin только в Driver mode
  const dev: User = {
    id: 'dev-driver',
    role: 'driver',
    displayName: 'Driver (DEV)',
  };
  setCurrentUser(dev);
} else {
  // Central mode ИЛИ PROD: требуем реальный login
  setCurrentUser(null);
}
```

**Status:** ✅ GOOD - DEV autologin отключен в Central mode

#### B. **Waybill UI Logic (`WaybillDetail.tsx`)** ✅
- Line 888, 917: Передает `appMode` в `changeWaybillStatus`
- Line 1315: Показывает кнопку "Submit" только в Central mode
- Line 1318: Показывает кнопку "Post" только в Driver mode (или если appMode не задан)

**Status:** ✅ GOOD - UI адаптируется под режим

#### C. **Sidebar Logic (`App.tsx:179`)** ✅
```typescript
const isDriverMode = appSettings?.appMode === 'driver' || !appSettings?.appMode;
```

Используется для условного отображения элементов меню (например, "Бланки ПЛ")

**Status:** ✅ GOOD

#### D. **Settings UI (`Admin.tsx:724-728`)** ✅
```typescript
<input
  type="radio"
  name="appMode"
  value="driver"
  checked={settings.appMode === 'driver' || !settings.appMode}
  onChange={() => handleSettingChange('appMode', 'driver')}
/>
<input
  type="radio"  
  name="appMode"
  value="central"
  checked={settings.appMode === 'central'}
  onChange={() => handleSettingChange('appMode', 'central')}
/>
```

**Status:** ✅ GOOD - Есть UI для переключения режимов

---

### 3. **USE_REAL_API Implementation** ⚠️ **NEEDS REVIEW**

**Current State:** `waybillApi.ts:13`
```typescript
const USE_REAL_API = true; // import.meta.env.VITE_USE_REAL_API === 'true';
```

**Problem:** Захардкожено на `true`, не привязано к `appMode`

**Expected Behavior:**
- **Central mode** → `USE_REAL_API = true` (использовать backend)
- **Driver mode** → `USE_REAL_API = false` (использовать mockApi + IndexedDB)

---

## Phase 3 Tasks

### ✅ Task 1: Location of appMode ✅
- **Status:** DONE
- **Location:** `AppSettings` in IndexedDB, accessed via `getAppSettings()`

### ✅ Task 2: Central/Driver Mode Rules ✅
- **Central Mode Rules** (in `auth.tsx`):
  - ✅ Requires real login (DEV autologin disabled)
  - ⚠️ **TODO:** USE_REAL_API should be `true`
  - ✅ Waybill workflow: `draft → submitted → posted → cancelled`

- **Driver Mode Rules**:
  - ✅ DEV autologin allowed (`import.meta.env.DEV && !isCentralMode`)
  - ⚠️ **TODO:** USE_REAL_API should be `false`
  - ✅ Waybill workflow: `draft → posted`
  - ✅ Can use IndexedDB/mockApi

### ⚠️ Task 3: Add Explicit Mode Switcher ⚠️
- **Status:** PARTIAL
- **Exists:** Admin panel has radio buttons for mode selection
- **Issue:** Требуется restart приложения после смены режима?
- **TODO:** 
  - Verify if mode switching works dynamically
  - Add confirmation dialog warning user about mode change implications

### 🆕 Task 4: Link USE_REAL_API to appMode
- **Current:** `waybillApi.ts` has hardcoded `USE_REAL_API = true`
- **Needed:** Dynamic selection based on `appMode`
  ```typescript
  const USE_REAL_API = await shouldUseRealApi();
  
  async function shouldUseRealApi(): Promise<boolean> {
    const settings = await getAppSettings();
    return settings.appMode === 'central';
  }
  ```

---

## Recommendations

### Option A: Simple Fix (Recommended)
1. Make `USE_REAL_API` dynamic in `waybillApi.ts`:
   - Read from `appMode` in AppSettings
   - Central mode → backend API
   - Driver mode → mockApi

2. Add warning to mode switcher in Admin panel:
   - "Смена режима требует перезагрузки приложения"

### Option B: Advanced (Future)
1. Create dedicated mode switch component with live updates
2. Reload app state when mode changes
3. Clear IndexedDB when switching to Central mode (optional)

---

## Next Steps for Phase 3 Completion

1. ✅ ~~Determine where appMode is stored~~ (DONE: AppSettings in IndexedDB)
2. ✅ ~~Verify Central mode requires real login~~ (DONE: works in auth.tsx)
3. ⚠️ **Fix `waybillApi.ts` to use dynamic USE_REAL_API based on appMode**
4. ⚠️ **Test mode switching in Admin panel**
5. ⚠️ **Add similar facades for other entities** (vehicleApi, employeeApi, etc.)

---

**Created:** 2025-11-30  
**Status:** Analysis Complete, Ready for Implementation
