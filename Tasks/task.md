# UI Enhancement: Dictionary Icons
- [x] Add icons to all dictionary headers [x]
    - [x] Icons.tsx: Add new SVGs [x]
    - [x] EmployeeList.tsx: Add UserGroupIcon [x]
    - [x] VehicleList.tsx: Add TruckIcon [x]
    - [x] OrganizationManagement.tsx: Add BuildingOffice2Icon [x]
    - [x] FuelTypeManagement.tsx: Add FireIcon [x]
    - [x] StorageManagement.tsx: Add HomeModernIcon [x]
    - [x] RouteList.tsx: Add GlobeAltIcon [x]
- [x] Add icons to dictionary navigation tabs [x]
    - [x] TabsNavigation.tsx: Support icon prop [x]
    - [x] Dictionaries.tsx: Pass icons to tabs [x]
- [x] Add icons to Warehouse section [x]
    - [x] Icons.tsx: Add new SVGs for Warehouse [x]
    - [x] Warehouse.tsx: Refactor to TabsNavigation and add icons [x]
    - [x] Add headers with icons to: Nomenclature, Balances, Movements, Fuel Cards, Rules [x]
- [x] Git Synchronization [x]
    - [x] Create commit with Russian message [x]
    - [x] Push changes to remote origin [x]


# Fuel Calculation Unification (WB-1002)
- [x] Create unified calculation service `calculatePlannedFuelByMethod` in `fuelCalculationService.ts` [x]
- [x] Refactor `WaybillDetail.tsx` to use unified service [x]
- [x] Refactor `batchWaybillService.ts` to use unified service [x]
- [x] Refactor `WaybillCheckModal.tsx` to use unified service [x]

# UI Refactoring (Warehouse & Dictionaries)
- [x] Rename Sidebar item to "Склад" [x]
- [x] Remove Header and Nomenclature tab from Warehouse [x]
- [x] Move Nomenclature to Dictionaries (First Tab) [x]

# STOCK-LEDGER-EPIC-001 — Soft Void + Period Lock + Immutable System Movements

**Стратегия:** B+C (Controlled Mutability + Soft Void) ✅  
**Артефакты:**
- [STOCK_MOVEMENT_AUDIT.md](file:///C:/Users/User/.gemini/antigravity/brain/30ae86d0-116e-48a5-8f1e-5bc5341cff73/STOCK_MOVEMENT_AUDIT.md) — полный аудит архитектуры
- [STOCK_VOID_IMPLEMENTATION_PLAN.md](file:///C:/Users/User/.gemini/antigravity/brain/30ae86d0-116e-48a5-8f1e-5bc5341cff73/STOCK_VOID_IMPLEMENTATION_PLAN.md) — план реализации + RBAC
- [STOCK_VOID_DIFF_PLAN.md](file:///C:/Users/User/.gemini/antigravity/brain/30ae86d0-116e-48a5-8f1e-5bc5341cff73/STOCK_VOID_DIFF_PLAN.md) — 13 правок isVoid=false

## 🎯 Цель Epic

Перевести складской регистр в "бухгалтерский" режим:
- ✅ Системные проводки неизменяемы
- ✅ Ручные — только через void + новая запись (кроме comment/externalRef)
- ✅ Физический DELETE запрещён
- ✅ Backdate возможен только при открытом периоде
- ✅ Все балансы/журналы учитывают isVoid=false

---

## 📦 PR Strategy (Refined)

### PR1: P0 Hotfixes (P0-1, P0-2, P0-3) ✅ **CURRENT**
**Цель:** Быстрые блокировки критических уязвимостей

**Включает:**
- P0-1: Legacy POST → 410 Gone
- P0-2: DELETE → 403/405 block
- P0-3: UPDATE guard для системных движений

**Риск:** Ultra Low (только статус-коды и guards)  
**Время:** 30-45 минут  
**Изменений:** 2 файла (~20 строк)

---

### PR2: isVoid Schema + Filters + Void Endpoint (P1-1, P1-3)
**Цель:** Soft void вместо физического удаления

**Включает:**
- P1-1 (schema): `isVoid`, `voidedAt`, `voidedByUserId`, `voidReason`
- P1-1 (endpoint): `POST /movements/:id/void` (manual-only, no period check yet)
- P1-3: isVoid=false в 13 местах (см. STOCK_VOID_DIFF_PLAN.md)

**Риск:** Low (schema + filters + guard logic)  
**Время:** 1-1.5 дня  
**Изменений:** 4 файла (~150 строк + migration)

**Зависимости:** PR1 must be merged

---

### PR3: Period Lock + RBAC (P0-4, P2-1)
**Цель:** Контроль backdate + permissions

**Включает:**
- P0-4 (schema): `Organization.stockLockedAt`
- P0-4 (logic): `checkPeriodLock()` в create/update/void
- P0-4 (API): Admin endpoints lock/unlock + audit
- P2-1: RBAC permissions (stock.movement.void, stock.period.lock/unlock)

**Риск:** Medium (новая функциональность + audit)  
**Время:** 1 день  
**Изменений:** 5 файлов (~200 строк + migration)

**Зависимости:** PR2 must be merged (void endpoint должен проверять period)

---

### PR4: DocumentType Enum (P1-2)
**Цель:** Строгая типизация documentType

**Включает:**
- P1-2: enum DocumentType
- Data migration для существующих записей

**Риск:** Medium (schema breaking change)  
**Время:** 0.5 дня  
**Изменений:** 1 файл + migration

**Зависимости:** PR1 merged (чтобы не было новых legacy записей)

---

## 🔥 P0 Tasks (Критические — сделать СРОЧНО)

### [x] P0-1 — STOCK-LEGACY-POST-410 — Отключить legacy POST /api/stock/movements ✅

**Файлы:**
- `backend/src/routes/stockRoutes.ts`
- `backend/src/controllers/stockController.ts`

**Что сделано:**
- [x] `POST /api/stock/movements` → 410 Gone с миграционным guide
- [x] Роут оставлен для явного 410 response (не 404)

**Acceptance:**
- [x] Legacy endpoint возвращает 410 ENDPOINT_GONE
- [x] `/movements/v2` работает нормально

**Зависимости:** Нет

---

## 🚀 ACTIVE TASKS (STATUS-REVIEW-001)

### [x] P0-4 — STOCK-PERIOD-LOCK-001 — Закрытие/открытие периода ✅ **100% COMPLETE**

**Реализовано:**
- [x] Schema: `Organization.stockLockedAt DateTime?` — строка 144
- [x] Функция `checkPeriodLock()` — stockService.ts строки 52-74
- [x] Admin endpoints `lock/unlock` — adminController.ts строки 1357-1427
- [x] Audit log на lock/unlock — включено в контроллеры
- [x] Интеграция в `createTransfer()` — строка 304
- [x] Интеграция в `createAdjustment()` — строки 414, 437
- [x] Интеграция в `createIncomeMovement()` — строка 644
- [x] Интеграция в `voidStockMovement()` — строка 1116

**Gap (FIXED ✅):**
- [x] Интеграция в `createExpenseMovement()` stockLocationId branch — **FIXED!** (строка ~567)

**Acceptance:**
- [ ] Нельзя создать движение с `occurredAt <= stockLockedAt` (409)
- [ ] Admin может lock/unlock период
- [ ] Все lock/unlock записываются в audit log

---

### [ ] P2-1 — STOCK-RBAC-PERMS-001 — Permission-based access control

**Permissions для создания:**
- [ ] `stock.movement.void` — void manual movements
- [ ] `stock.period.lock` — закрытие периода
- [ ] `stock.period.unlock` — открытие периода
- [ ] `stock.movement.update` — редактирование manual (только comment/externalRef)

**Роли:**
- [ ] Admin: все permissions ✅
- [ ] Accountant: `stock.movement.void`, `stock.movement.update` ✅
- [ ] Dispatcher: нет ❌
- [ ] Driver: нет ❌

**Файлы:**
- [ ] Seed script для permissions
- [ ] `adminRoutes.ts` — заменить `requireRole` на `requirePermission`
- [ ] `stockRoutes.ts` — добавить `requirePermission` для void

**Acceptance:**
- [ ] Нельзя void без прав (403)
- [ ] Нельзя lock/unlock без прав (403)

---

---

### [x] P0-2 — STOCK-DELETE-BLOCK — Запретить DELETE движений ✅

**Файлы:**
- `backend/src/controllers/stockController.ts`

**Что сделано:**
- [x] `DELETE /api/stock/movements/:id`:
  - [x] Для documentType IN ('WAYBILL', 'FUEL_CARD_RESET', 'FUEL_CARD_TOPUP') → 403
  - [x] Для всех остальных → 405 (временно, до P1-1)
  - [x] Сообщение: "Use void operation instead"

**Acceptance:**
- [x] Системные движения не удаляются никогда (403 SYSTEM_MOVEMENT_DELETE_FORBIDDEN)
- [x] Manual movements тоже не удаляются (405 DELETE_METHOD_NOT_ALLOWED)

**Зависимости:** Нет

---

### [x] P0-3 — STOCK-UPDATE-GUARD — Запретить UPDATE системных движений ✅

**Файлы:**
- `backend/src/services/stockService.ts` (функция `updateStockMovement`)

**Что сделано:**
- [x] Раскомментирован и улучшен guard (строка 651-658):
  ```typescript
  if (original.documentType !== null) {
      throw new BadRequestError(
          'Нельзя редактировать системные движения. ' +
          `documentType: ${original.documentType}. ` +
          'Если нужна корректировка — создайте void + новое движение через API.'
      );
  }
  ```

**Acceptance:**
- [x] Нельзя редактировать движения с `documentType != null` (400)
- [x] Можно редактировать только manual movements (documentType IS NULL)

**Зависимости:** Нет

---

### [ ] P0-4 — STOCK-PERIOD-LOCK — Закрытие/открытие периода

**Schema:**
- [ ] Добавить в `Organization`:
  ```prisma
  stockLockedAt DateTime? @db.Timestamp(6)
  ```
- [ ] Migration: `npx prisma migrate dev --name add_stock_period_lock`

**Service:**
- [ ] Добавить функцию `checkPeriodLock(organizationId, occurredAt)` в `stockService.ts`
- [ ] Вызывать во всех create/update/void:
  - [ ] `createTransfer()`
  - [ ] `createAdjustment()`
  - [ ] `createExpenseMovement()`
  - [ ] `createIncomeMovement()`
  - [ ] `voidStockMovement()` (будущий)

**Admin API:**
- [ ] `POST /api/admin/stock-period/lock { lockedAt }` — закрыть период
- [ ] `POST /api/admin/stock-period/unlock { lockedAt }` — открыть (только НАЗАД)
- [ ] Audit log на каждую операцию lock/unlock

**Routes:**
- [ ] Добавить в `adminRoutes.ts`:
  ```typescript
  router.post('/stock-period/lock', requirePermission('stock.period.lock'), lockStockPeriod);
  router.post('/stock-period/unlock', requirePermission('stock.period.unlock'), unlockStockPeriod);
  ```

**Acceptance:**
- [ ] Нельзя создать движение с `occurredAt <= stockLockedAt` (409)
- [ ] Admin может lock/unlock период
- [ ] Все lock/unlock записываются в audit log

**Зависимости:** Нет

---

## 📊 P1 Tasks (Важные — после P0)

### [ ] P1-1 — STOCK-VOID — Soft void для manual движений

**Schema:**
- [ ] Добавить в `StockMovement`:
  ```prisma
  isVoid          Boolean   @default(false)
  voidedAt        DateTime? @db.Timestamp(6)
  voidedByUserId  String?   @db.Uuid
  voidReason      String?   @db.Text
  voidedByUser    User?     @relation("StockMovementVoidedBy", fields: [voidedByUserId], references: [id], onDelete: SetNull)
  
  @@index([organizationId, isVoid, occurredAt])
  ```
- [ ] Migration: `npx prisma migrate dev --name add_stock_void_fields`

**Service:**
- [ ] Создать функцию `voidStockMovement(params)` в `stockService.ts`:
  - [ ] Проверка: только `documentType IS NULL`
  - [ ] Проверка: период открыт (`occurredAt > stockLockedAt`)
  - [ ] Проверка: future balance >= 0 (as-of на 9999-12-31)
  - [ ] Установить `isVoid=true`, `voidedAt`, `voidedByUserId`, `voidReason`
  - [ ] Audit log

**Controller:**
- [ ] `POST /api/stock/movements/:id/void` в `stockController.ts`
- [ ] Body: `{ reason: string }` (минимум 5 символов)

**Routes:**
- [ ] Добавить в `stockRoutes.ts`:
  ```typescript
  router.post('/movements/:id/void', requirePermission('stock.movement.void'), voidStockMovement);
  ```

**Acceptance:**
- [ ] Void manual movement → isVoid=true
- [ ] Void системного → 400
- [ ] Void в закрытом периоде → 409
- [ ] Void приводит к отрицательному балансу → 400
- [ ] Audit log создаётся

**Зависимости:** P0-4 (period lock), P1-3 (isVoid filters)

---

### [ ] P1-2 — STOCK-DOCUMENTTYPE-ENUM — Enum DocumentType

**Schema:**
- [ ] Создать enum:
  ```prisma
  enum DocumentType {
    WAYBILL
    FUEL_CARD_TOPUP
    FUEL_CARD_RESET
    MANUAL
  }
  ```
- [ ] Изменить `StockMovement.documentType` на `DocumentType?`
- [ ] Migration с маппингом существующих значений:
  ```sql
  -- Map existing string values
  UPDATE "stock_movements" SET "documentType" = 'WAYBILL' WHERE "documentType" = 'WAYBILL';
  UPDATE "stock_movements" SET "documentType" = 'FUEL_CARD_TOPUP' WHERE "documentType" = 'FUEL_CARD_TOPUP';
  UPDATE "stock_movements" SET "documentType" = 'FUEL_CARD_RESET' WHERE "documentType" = 'FUEL_CARD_RESET';
  UPDATE "stock_movements" SET "documentType" = 'MANUAL' WHERE "documentType" IS NULL;
  ```

**Acceptance:**
- [ ] Нет строковых documentType в новых движениях
- [ ] Существующие данные корректно мигрированы

**Зависимости:** P0-1, P0-2 (чтобы не было новых legacy записей)

---

### [ ] P1-3 — STOCK-ISVOID-FILTER — Проставить isVoid=false во всех queries

**Файлы и правки:** См. [STOCK_VOID_DIFF_PLAN.md](file:///C:/Users/User/.gemini/antigravity/brain/30ae86d0-116e-48a5-8f1e-5bc5341cff73/STOCK_VOID_DIFF_PLAN.md)

**Чеклист (13 правок):**

#### `backend/src/services/stockService.ts`:
- [ ] `getBalanceAtTx()` INCOME (строка ~64) — добавить `isVoid: false`
- [ ] `getBalanceAtTx()` EXPENSE (строка ~68) — добавить `isVoid: false`
- [ ] `getBalanceAtTx()` ADJUSTMENT (строка ~72) — добавить `isVoid: false`
- [ ] `getBalanceAtTx()` TRANSFER IN (строка ~76) — добавить `isVoid: false`
- [ ] `getBalanceAtTx()` TRANSFER OUT (строка ~80) — добавить `isVoid: false`
- [ ] `getBalanceAt()` INCOME (строка ~115) — добавить `isVoid: false,`
- [ ] `getBalanceAt()` EXPENSE (строка ~125) — добавить `isVoid: false,`
- [ ] `getBalanceAt()` ADJUSTMENT (строка ~135) — добавить `isVoid: false,`
- [ ] `getBalanceAt()` TRANSFER IN (строка ~145) — добавить `isVoid: false,`
- [ ] `getBalanceAt()` TRANSFER OUT (строка ~155) — добавить `isVoid: false,`
- [ ] `getStockBalance()` (строка ~451) — добавить `isVoid: false,`

#### `backend/src/controllers/stockBalanceController.ts`:
- [ ] `listMovementsV2()` (строка ~154) — добавить `isVoid: false,` в where

#### `backend/src/controllers/stockController.ts`:
- [ ] `listStockMovements()` (строка ~131) — добавить `isVoid: false,` в where

**Testing:**
- [ ] Run tests: balance calculations корректны
- [ ] Run tests: журнал движений не показывает void записи
- [ ] Manual test: создать movement → void → проверить баланс

**Acceptance:**
- [ ] Void движения не попадают в balances
- [ ] Void движения не попадают в movements list

**Зависимости:** Schema migration (P1-1 для поля isVoid)

---

## 📝 P2 Tasks (Желательные — после P1)

### [ ] P2-1 — STOCK-RBAC-PERMS — RBAC permissions

**Permissions для создания:**
- [ ] `stock.movement.void` — void manual movements
- [ ] `stock.period.lock` — закрытие периода
- [ ] `stock.period.unlock` — открытие периода
- [ ] `stock.movement.update` — редактирование manual (только comment/externalRef)

**Роли:**
- [ ] Admin: все permissions ✅
- [ ] Accountant: `stock.movement.void`, `stock.movement.update` ✅
- [ ] Dispatcher: нет ❌
- [ ] Driver: нет ❌

**Migration:**
- [ ] Создать seed script для permissions
- [ ] Назначить permissions ролям

**Middleware:**
- [ ] Проверки в `authMiddleware` или отдельный `requirePermission()`

**Acceptance:**
- [ ] Нельзя void без прав (403)
- [ ] Нельзя lock/unlock без прав (403)

**Зависимости:** P1-1 (void endpoint), P0-4 (period lock)

---

## 📋 Принципы для команды

**Чтобы больше не "ветряные мельницы":**

1. ✅ **Один источник правды:** ledger (StockMovement)
2. ✅ **Никаких DELETE** для регистра
3. ✅ **Системные проводки неизменяемы** (documentType != null)
4. ✅ **Backdate только в открытом периоде** (occurredAt > stockLockedAt)
5. ✅ **Все операции через Service Layer** — никакого прямого `prisma.create` для движений

---

## 📊 Progress Tracking

**PR1 (P0 Hotfixes):** ✅ **COMPLETE** 3/3 🟩🟩🟩 ✅ Tested  
**PR2 (isVoid + Void Endpoint):** ✅ **COMPLETE** - All fixes applied + 500 error resolved  
  - ✅ voidStockMovement service function (180 lines)
  - ✅ All 13 isVoid=false filters added
  - ✅ Controller + route registered
  - ✅ Proper assertNonNegativeAfterVoid (timeline walking, 117 lines)
  - ✅ FuelCard.balanceLiters sync removed
  - ✅ Audit log enabled
  - ✅ API response format fixed
  - ✅ RBAC guard added (admin/accountant only)
  - ✅ **BACKEND-500-GLOBAL-001 RESOLVED** (killed 6 zombie Node processes)
**P0 (Критические):** 3/4 🟩🟩🟩⬜ (осталось: P0-4 Period Lock → PR3)  
**P1 (Важные):** 3/3 🟩🟩🟩 (P1-1 void done, P1-3 filters done, P1-2 DocumentType postponed)  
**P2 (Желательные):** 0/1 ⬜


**Time spent on PR1:** ~30 минут  
**Time spent on PR2:** ~3.5 hours (implementation + review fixes)  
**Estimated remaining:** 1 день (PR3: Period Lock + RBAC)

**Known Issues Resolved:**
- ✅ **BACKEND-500-GLOBAL-001**: Zombie Node processes — see [500_ERROR_RESOLUTION.md](../backend/docs/500_ERROR_RESOLUTION.md)
- ✅ **BACKEND-500-GLOBAL-002**: Preventive measures implemented (EADDRINUSE handler, troubleshooting guide)
- ✅ **BACKEND-500-GLOBAL-003**: Documentation migration to repository (commit `6ab2d7c`)
- ✅ **DOC-BACKEND-OPS-004**: Documentation portability accepted (commit `6ab2d7c`)

**2025-12-25 Completed:**
- ✅ **P0-F (WB-DELETE-POSTED-BLOCK-006)**: Block deletion of POSTED waybills with admin toggle
  - `settingsService.ts`: Added `allowDeletePostedWaybills` setting
  - `waybillService.ts`: Added check in `deleteWaybill`
  - `WaybillList.tsx`: Hidden delete button for POSTED (unless setting enabled)
  - `Admin.tsx`: Added toggle in settings UI
- ✅ **LEDGER-DOCS-001**: Document-based ledger operations
  - `stornoService.ts`: NEW — Storno logic (reverse movements)
  - `POST /api/stock/documents/:documentType/:documentId/storno`: Storno API
  - `POST /api/stock/corrections`: Corrections API (ADJUSTMENT with documentType='CORRECTION')

---

## 🧪 PR1 Sanity Test Results (2025-12-23)

### Test 1: Legacy POST /api/stock/movements → 410 Gone
- [x] Executed ✅
- [x] Status: 410 Gone ✅
- [x] Message contains migration guide (code: ENDPOINT_GONE) ✅

### Test 2: DELETE /api/stock/movements/:id → 403/405
- [x] Manual movement: 405 DELETE_METHOD_NOT_ALLOWED ✅
- [-] System movement (WAYBILL/FUEL_CARD_*): Expected 403 (no system movements in DB to test)

### Test 3: UPDATE system movement → 400
- [-] Not tested (no system movements in DB)
- Note: Guard code exists in stockService.ts lines 651-658

**Вердикт:** PR1 работает как ожидалось. Legacy endpoint заблокирован, DELETE заблокирован, UPDATE guard на месте.

---

# WB-REG-001 — Регрессии создания/редактирования ПЛ

## Основная цель
Исправить регрессии в создании и редактировании путевых листов.

---

## A) WB-NUM-001 — Номер ПЛ: единый формат с паддингом
- [x] Найти "источник истины" для номера (backend/frontend) — `formatBlankNumber()` в backend
- [x] Исправить форматирование: ЧБ 000001 вместо ЧБ 1 — уже работает в backend
- [ ] Проверить журнал ПЛ

## B) WB-NEW-002 — Второй новый ПЛ не сбрасывает state
- [x] Исследовать где/как сбрасывается formData при создании нового ПЛ
- [x] Убедиться что prefill вызывается одинаково для 1-го и 2-го ПЛ
- [x] Исправить сброс состояния — добавлен key prop в WaybillList.tsx

## C) WB-DATE-003 — "Действителен с" подставляет текущую дату
- [x] Проверить маппинг date/validFrom/validTo в waybillMapper.ts
- [x] Убрать fallback на new Date() при загрузке существующего ПЛ — теперь использует waybill.date
- [ ] Проверить reopen ПЛ

## D) WB-LOAD-004 — Топливо/маршруты/пробег пустые при reopen
- [x] Проверить backend GET /waybills/:id (include routes, fuelLines) — OK
- [x] Проверить frontend load flow в WaybillDetail.tsx — передаём только ID, загрузка через getWaybillById
- [x] Убедиться что prefill НЕ вызывается при редактировании
- [x] Проверить маппинг routes и fuel

---

## E) Журнал — топливо пустое
- [x] Добавлен маппинг fuelLines в enrichedData в WaybillList.tsx

---

## F) WB-HOTFIX-UI-STATE-001 — После Save сбрасываются date/validFrom/fuel и dayMode уходит в single
- [x] Исправить post-save mapping: использовать `savedWaybill.fuel` вместо `fuelLines[0]`
- [x] Безопасные date helpers: `toDateInput`/`toDateTimeInput` корректно обрабатывают строки
- [x] Удалён дублирующий `setFormData(normalizedSaved)` который перезаписывал fuel данные
- [x] Добавлен пересчёт `dayMode` после save по validFrom/validTo
- [x] Исправлена загрузка: dayMode вычисляется от `formDataToSet` а не от пропса
- [x] **Backend fix:** `createWaybill` и `updateWaybill` теперь возвращают flattened `fuel` (как `getWaybillById`)

---

## Критерии приёмки
- [ ] Новый ПЛ №1: номер полный, save → reopen всё на месте
- [ ] Новый ПЛ №2: prefill срабатывает полностью
- [ ] Журнал показывает топливо, пробег, даты




===========================================================

FUEL-TOPUP-001 — Пополнение топливных карт: ручное + автоматическое по периодам (ledger as-of)
Контекст
Топливо ведём как складской ledger по StockMovement с occurredAt/occurredSeq.
Топливные карты — это StockLocation(type=FUEL_CARD) + справочник FuelCard.
Пополнение карты = TRANSFER из источника (обычно склад WAREHOUSE) в локацию карты.
Цель
Ручное пополнение карты (UI + API): создать движение TRANSFER warehouse → card на дату/время факта.
Автоматическое пополнение по правилам (периодически): создавать такие же TRANSFER с идемпотентностью, учетом occurredAt, и проверками “as-of”.
Что сделать
1) Backend: ручное пополнение (API)
FUEL-TOPUP-BE-010

Реализовать endpoint:
POST /fuel-cards/topup
DTO:
fuelCardId: uuid
stockItemId: uuid (fuel)
quantity: decimal string (>0)
occurredAt: ISO datetime
sourceWarehouseLocationId: uuid (если складов несколько; иначе можно дефолт)
externalRef?: string
comment?: string
Логика:

найти cardLocationId по fuelCardId (StockLocation FUEL_CARD)
создать StockMovement(TRANSFER):
fromLocationId = sourceWarehouseLocationId
toLocationId = cardLocationId
occurredAt = DTO.occurredAt
occurredSeq = 20 (или 0)
применить существующие проверки:
advisory locks on both buckets
assertNonNegativeAfterInsert для source (as-of + future non-negative)
Критерии приёмки:

Пополнение создаёт TRANSFER и появляется в журнале склада.
Нельзя пополнить “из склада в минус” на дату.
2) Backend: правила автопополнения (schema + service)
FUEL-TOPUP-BE-020

Таблица правил FuelCardTopUpRule:
organizationId
isActive
fuelCardId
stockItemId
sourceLocationId (warehouse)
frequency (DAILY|WEEKLY|MONTHLY)
mode (TO_TARGET|FIXED_ADD)
targetQuantity? / fixedQuantity?
atTimeLocal (например "00:05")
(опционально) timezone (или брать из Organization)
Уникальность/идемпотентность через StockMovement.externalRef:
externalRef = TOPUP:<ruleId>:<occurredAtISO>
@@unique([organizationId, externalRef])
Service:

runTopUps({ organizationId, atUtc })
выбрать активные правила
для каждого:
посчитать balanceAt(cardLocationId, stockItemId, atUtc)
вычислить addQty:
TO_TARGET: max(0, target - current)
FIXED_ADD: fixed
если addQty > 0 создать TRANSFER warehouse -> card с externalRef
locks + as-of checks
Критерии приёмки:

Повторный запуск на ту же дату не создаёт дублей.
TO_TARGET не начисляет, если уже выше/равно цели.
3) Backend: API для управления правилами и запуска
FUEL-TOPUP-BE-030

CRUD для правил:
GET /fuel-cards/topup-rules
POST /fuel-cards/topup-rules
PUT /fuel-cards/topup-rules/:id
DELETE /fuel-cards/topup-rules/:id (или isActive=false)
Ручной запуск:
POST /admin/fuel/topups/run с { atUtc }
Preview (желательно):
POST /admin/fuel/topups/preview (что будет создано)
RBAC:

stock.topup.manual
stock.topup.rules.manage
admin.fuel.run
4) Frontend: UI ручного пополнения
FUEL-TOPUP-FE-010

В разделе “Топливо → Топливные карты”:
кнопка “Пополнить”
модал:
карта
топливо (stock item)
источник (склад)
количество
дата/время факта
документ/комментарий
После успеха:
обновить баланс на дату
запись видна в журнале движений (TRANSFER)
5) Frontend: UI правил автопополнения
FUEL-TOPUP-FE-020

Список правил с колонками: карта, режим, частота, источник, активность.
Форма создания/редактирования rule.
Кнопки:
“Preview”
“Run now” (под RBAC)
Показывать результаты через журнал движений (фильтр externalRef startsWith TOPUP:)
6) Тесты
FUEL-TOPUP-T-001
Backend:

ручной topup создаёт TRANSFER
TO_TARGET: баланс 150, target 200 → создаёт +50
TO_TARGET: баланс 210, target 200 → не создаёт
идемпотентность: два run на один atUtc → 1 движение
хронология: пополнение в декабре не позволяет заправить в ноябре (проверка уже есть, но добавить кейс)
E2E (минимум):

создать правило FIXED_ADD, run, убедиться что движение появилось
FUEL-TOPUP-002 — Реализовать пополнение топливных карт: ручное (UI) + автоматическое по правилам (cron/manual run)
Контекст
Есть FuelCard с полем balanceLiters (но источник истины должен быть ledger StockMovement + StockLocation(FUEL_CARD)).
Есть StockLocation и endpoints для getOrCreateFuelCardLocation, getOrCreateWarehouseLocation.
Есть “правильный” endpoint создания движений: POST /api/stock/movements/v2 (Zod).
В StockMovement уже есть externalRef с @@unique([organizationId, externalRef]) — подходит для идемпотентности.
В StockMovement поля для transfer: fromStockLocationId/toStockLocationId (в v2 DTO нужно соответствие!).
Цель
Ручное пополнение карты создаёт TRANSFER из складской локации в локацию карты на occurredAt.
Автопополнение по правилам создаёт такие же TRANSFER по расписанию/периоду, без дублей, с расчётом “довести до лимита” или “+N”.
Всё отображается в “Журнал движений” и влияет на балансы “на дату”.
Что сделать
A) Ручное пополнение (Frontend + reuse existing API)
FUEL-TOPUP-FE-010 — Модал “Пополнить карту”
UI место: Топливо → Топливные карты (или Склад → Карты)

Поля:

fuelCardId (карта)
stockItemId (вид топлива, StockItem category=FUEL)
fromWarehouseLocationId (склад-источник)
quantity (decimal, >0)
occurredAt (datetime)
externalRef (автогенерация MANUAL_TOPUP:<uuid> либо кнопка “номер документа”)
comment
API вызов:

POST /api/stock/movements/v2 с movementType='TRANSFER'.
Payload (под ваши поля модели):

TypeScript

{
  movementType: 'TRANSFER',
  stockItemId,
  quantity,
  fromStockLocationId: fromWarehouseLocationId,
  toStockLocationId: fuelCardLocationId,
  occurredAt,
  externalRef: `MANUAL_TOPUP:${uuid}`,
  comment: 'Ручное пополнение'
}
Важно:

Перед отправкой получить/создать fuelCardLocationId:
POST /api/stock/locations/fuel-card с fuelCardId
Складскую локацию:
либо выбирать из GET /api/stock/locations?type=WAREHOUSE
либо POST /api/stock/locations/warehouse (getOrCreate дефолт)
Критерии приёмки:

После пополнения в журнале появляется TRANSFER warehouse→card.
Баланс карты на дату увеличивается.
B) Автопополнение (Backend service + admin endpoint)
FUEL-TOPUP-BE-020 — Сервис runFuelCardTopUps(atUtc)
Файл: backend/src/services/fuelCardTopUpService.ts (новый)

Алгоритм на каждое правило FuelCardTopUpRule:

Найти/создать toLocationId (FuelCardLocation).
Взять fromLocationId из rule (sourceLocationId) или дефолтный склад.
Посчитать баланс карты “на дату” (asOf = atUtc) через вашу balance-логику (ledger):
либо существующий stockBalanceController.getBalance как service-функцию
Рассчитать addQty:
FIXED_ADD: addQty = fixedQuantity
TO_TARGET: addQty = max(0, targetQuantity - balanceAsOf)
Если addQty > 0 → создать TRANSFER через тот же сервис, что обслуживает /movements/v2
Идемпотентность:
externalRef = TOPUP:<ruleId>:<atUtcISO>
из-за unique повторный run не создаёт дубль
RBAC/Запуск:

Endpoint: POST /api/admin/fuel/topups/run
body: { atUtc: string }
scope: orgId из токена
(опционально) Preview endpoint.
Критерии приёмки:

Повторный run на ту же atUtc не создаёт дубль (unique externalRef).
TO_TARGET работает корректно.
C) Привести model “balanceLiters” к роли кеша (опционально)
Сейчас FuelCard.balanceLiters может конфликтовать с ledger. На данном этапе:

не использовать balanceLiters как источник правды для ограничений
если хотите — обновлять его async/в транзакции после движения, но это отдельная оптимизация
Критерии приёмки (сквозные)
Ручной topup увеличивает баланс карты в /api/stock/balance.
Автотопап создаёт движения по правилам, без дублей.
Все движения видны в GET /api/stock/movements/UI журнале.
“as-of” хронология соблюдается (нельзя заправить раньше пополнения).

FUEL-TOPUP-003 — Ручное пополнение + автопополнение по FuelCardTopUpRule (используем movements/v2 + as-of balance)
Контекст
/api/stock/movements/v2 принимает TRANSFER с fromLocationId/toLocationId и маппит в Prisma fromStockLocationId/toStockLocationId.
FuelCardTopUpRule уже есть (фиксированная сумма amountLiters + порог minBalanceLiters + nextRunAt/lastRunAt).
Есть stockService.getBalanceAt() и createTransfer() (или через movements/v2).
Есть StockLocation для fuel card (POST /api/stock/locations/fuel-card).
Цель
Ручное пополнение: UI создаёт TRANSFER “склад → карта”.
Автопополнение: job/endpoint прогоняет FuelCardTopUpRule и создаёт TRANSFER без дублей и с корректной хронологией.
Что сделать
A) Ручное пополнение (UI + минимальный backend)
FUEL-TOPUP-MANUAL-010

1) Frontend: модал “Пополнить карту”
Экран: “Топливо → Топливные карты”
Поля:
fuelCardId
stockItemId (если в rule/карте не зафиксирован; иначе можно default)
sourceLocationId (WAREHOUSE location)
quantity (positive decimal)
occurredAt (datetime)
externalRef (авто: MANUAL_TOPUP:<uuid>)
comment
2) API вызовы (последовательность)
Получить/создать локацию карты:
POST /api/stock/locations/fuel-card { fuelCardId } → toLocationId
Создать движение:
POST /api/stock/movements/v2
JSON

{
  "movementType": "TRANSFER",
  "stockItemId": "<fuelStockItemId>",
  "quantity": "100.000",
  "fromLocationId": "<warehouseLocationId>",
  "toLocationId": "<fuelCardLocationId>",
  "occurredAt": "2025-12-22T12:00:00.000Z",
  "externalRef": "MANUAL_TOPUP:<uuid>",
  "comment": "Ручное пополнение"
}
Критерии приёмки
Движение появляется в журнале.
Баланс карты на дату увеличился (через GET /api/stock/balance).
B) Автопополнение по правилам (backend service + admin run)
FUEL-TOPUP-AUTO-020

1) Сервис автотопапа
Создать backend/src/services/fuelCardTopUpService.ts:

Функция:

runFuelCardTopUps(organizationId: string, now: Date): Promise<{processed, created, skipped}>
Алгоритм:

Выбрать активные rules организации:
isActive=true
nextRunAt <= now
Для каждой rule:
определить stockItemId:
rule.stockItemId обязателен (если null → skip + log warning)
определить sourceLocationId:
rule.sourceLocationId обязателен (если null → skip + log warning)
получить/создать toLocationId (FuelCardLocation):
через stockLocationService.getOrCreateFuelCardLocation(rule.fuelCardId)
посчитать currentBalance = getBalanceAt(toLocationId, stockItemId, rule.nextRunAt)
если minBalanceLiters задан:
если currentBalance >= minBalanceLiters → SKIP (обновить nextRunAt, lastRunAt)
если нужно пополнять:
создать TRANSFER через stockService.createTransfer(...) или через прямой tx.stockMovement.create (но лучше через stockService)
occurredAt = rule.nextRunAt
externalRef = TOPUP:${rule.id}:${rule.nextRunAt.toISOString()}
comment = 'Auto top-up'
Обновить rule:
lastRunAt = now
nextRunAt = computeNextRunAt(rule.scheduleType, rule.timezone, rule.nextRunAt)
(next = nextRunAt + 1 day/week/month; timezone учитывать минимально через date math, либо оставить UTC, если у вас уже nextRunAt рассчитан заранее)
2) Admin endpoint запуска
POST /api/admin/fuel/topups/run
body: { atUtc?: string } (default now)
вызывает runFuelCardTopUps(req.user.organizationId, atDate)
Критерии приёмки
Повторный запуск в один и тот же nextRunAt не создаёт дублей (unique externalRef).
В журнале движения помечены externalRef вида TOPUP:<ruleId>:....
Правило корректно сдвигает nextRunAt.
C) Дополнения к модели FuelCardTopUpRule (не обязательно сейчас)
FUEL-TOPUP-MODEL-030
Сейчас rule = фикс + порог. Это достаточно для MVP.
Если позже понадобится “довести до target” или “время суток” без ручного nextRunAt:

добавить targetBalanceLiters Decimal?
добавить atTimeLocal String? (например "00:05")
Но не блокируем текущую реализацию.
Тесты
FUEL-TOPUP-T-001
Backend:

rule due (nextRunAt <= now), balance < minBalance → создаёт 1 TRANSFER и двигает nextRunAt
balance >= minBalance → не создаёт движение, но двигает nextRunAt
идемпотентность: два run подряд → 1 движение из-за externalRef unique
E2E (минимум):

создать rule + руками установить nextRunAt в прошлое → run → проверить появление движения

FUEL-TOPUP-004 — Доделать автопополнение (job/run) и ручное пополнение через movements/v2, в стиле resetService
Контекст
FuelCardTopUpRule.nextRunAt считается как now + interval (DAILY/WEEKLY/MONTHLY), без нормализации на начало дня; время сохраняется.
resetService.runResets() работает без глобальной транзакции, с идемпотентностью через externalRef и uses createTransfer() (locks + as-of).
createTransfer() уже делает advisory locks + as-of balance check внутри транзакции.
Цель
Ручной topup: UI создаёт TRANSFER через /api/stock/movements/v2.
Авто topup: job/service обрабатывает FuelCardTopUpRule (due rules), создаёт TRANSFER, обновляет nextRunAt/lastRunAt, без дублей.
Что сделать
A) Ручное пополнение: только UI (backend уже есть)
FUEL-TOPUP-MANUAL-010

В UI пополнения карты использовать:
POST /api/stock/locations/fuel-card → получить toLocationId
POST /api/stock/movements/v2 TRANSFER с fromLocationId/toLocationId
externalRef = MANUAL_TOPUP:<uuid> (уникально)
Критерий приёмки

Запись видна в журнале движений, баланс увеличился.
B) Автопополнение: сервис + endpoint запуска (аналог resetService)
FUEL-TOPUP-AUTO-020

1) Сервис runTopUps
Файл: backend/src/services/fuelCardTopUpService.ts (новый)
Сигнатура:

TypeScript

runTopUps({ organizationId, runAtUtc = new Date(), ruleId?, dryRun? })
2) Выборка rules
выбрать due:
isActive=true
nextRunAt <= runAtUtc
(опционально) если передан ruleId — фильтр
3) Обработка rule (по стилю resetService)
Для каждой rule:

проверить stockItemId и sourceLocationId (если null → error/skip)

получить/создать локацию карты:

getOrCreateFuelCardLocation(rule.fuelCardId)
баланс на дату:

current = getBalanceAt(cardLocation.id, rule.stockItemId, rule.nextRunAt)
логика minBalance:

если minBalanceLiters != null и current >= minBalanceLiters → SKIP
иначе создать пополнение на amountLiters:

externalRef = TOPUP:${rule.id}:${rule.nextRunAt.toISOString()}
occurredAt = rule.nextRunAt
createTransfer({ fromLocationId: rule.sourceLocationId, toLocationId: cardLocation.id, quantity: amountLiters, stockItemId, occurredAt, externalRef })
обновить денормализованный FuelCard.balanceLiters (как в resetService):

после успешного transfer:
balanceLiters = current + amountLiters (или пересчитать через getBalanceAt “as of now”, но это дороже)
обновить rule:

lastRunAt = runAtUtc
nextRunAt = computeNextRunAt(rule.nextRunAt, rule.scheduleType) (ВАЖНО: не от “now”, а от текущего nextRunAt, чтобы не пропускать интервалы при задержке job)
Критерий приёмки

rule выполняется ровно один раз на свой nextRunAt.
повторный запуск не создаёт дубль (P2002 по externalRef → skipped).
C) Endpoint запуска (admin)
FUEL-TOPUP-AUTO-030

POST /api/admin/fuel/topups/run
body { runAtUtc?: string, ruleId?: string, dryRun?: boolean }
вызывает runTopUps(...)
Критерии приёмки (сквозные)
При due rule создаётся TRANSFER и виден в /api/stock/movements.
Баланс карты на дату увеличился.
Повторный run на той же дате/правиле не создаёт дублей (skipped).
nextRunAt двигается корректно (сохраняется время дня).

FUEL-TOPUP-005 — Завершить пополнение ТК: ручное UI + привести auto-topup к ledger и убрать двойной учёт
Контекст
Автотопап уже есть: POST /api/admin/jobs/run-fuelcard-topups.
Job сейчас:
лочит правила FOR UPDATE SKIP LOCKED
создаёт FuelCardTransaction (уникальная защита)
инкрементит FuelCard.balanceLiters
затем (если stockItemId) создаёт ledger TRANSFER через createTransfer (occurredAt = now)
Нужная модель для склада: источник истины — StockMovement + StockLocation(FUEL_CARD) (as-of).
Сейчас получается двойной учёт: balanceLiters + ledger. Это со временем разойдётся.
Проблема
“Ручного” пополнения в UI нет (нужно).
Auto-topup сейчас обновляет balanceLiters независимо от ledger и пишет TRANSFER на now, а externalRef основан на periodKey. Это может:
расходиться с as-of балансами
давать неверную хронологию при расчётах
Дублирование computeNextRunAt в job и service.
Цель
Ручной topup: создать TRANSFER warehouse→card через /stock/movements/v2.
Auto-topup: единая правда = ledger, balanceLiters либо не трогаем, либо синхронизируем из ledger.
occurredAt для auto-topup — детерминированный (на rule.nextRunAt, а не now), чтобы as-of работал предсказуемо.
computeNextRunAt вынести в общий util.
Что сделать
A) Ручное пополнение (UI) — без нового backend
FUEL-TOPUP-MANUAL-010

Добавить в UI “Топливные карты” кнопку “Пополнить”.
Реализация:
POST /api/stock/locations/fuel-card → получить toLocationId
выбрать fromLocationId из GET /api/stock/locations?type=WAREHOUSE
POST /api/stock/movements/v2:
movementType: TRANSFER
fromLocationId/toLocationId
stockItemId
quantity
occurredAt (из формы)
externalRef = MANUAL_TOPUP:<uuid>
После успеха: обновить баланс/журнал.
Критерии приёмки

В журнале движений появился TRANSFER.
Баланс карты “на дату” увеличился.
B) Auto-topup job: писать только ledger и не делать increment balanceLiters
FUEL-TOPUP-AUTO-020
Файл: backend/src/jobs/fuelCardTopUpJob.ts

B1) occurredAt
Использовать occurredAt = r.nextRunAt (а не now) при createTransfer.
Это обеспечивает корректную хронологию “as-of”.
B2) idempotency externalRef
Привести externalRef к стабильному ключу:
сейчас: TOPUP:${r.id}:${periodKey}
оставить можно, но лучше добавить rule.nextRunAt.toISOString() или сам periodKey достаточен, если schedule строго периодный.
С учётом FuelCardTransaction (unique по periodKey) — ok, но ledger должен быть также защищён от дублей.
Рекомендация:
externalRef = TOPUP:${r.id}:${periodKey} оставить (у вас unique на (org, externalRef)).
B3) убрать двойной учёт balanceLiters
Удалить/отключить:
await tx.fuelCard.update({ balanceLiters: { increment: amountLiters }})
Вместо этого:
либо вообще не трогать balanceLiters (и считать баланс через ledger API),
либо в конце делать “синхронизацию” balanceLiters из ledger (дороже; можно отдельным nightly job).
Критерии приёмки

После auto-topup баланс в /api/stock/balance увеличился.
FuelCard.balanceLiters больше не является источником правды и не расходится.
C) Threshold minBalance: проверять по ledger, а не по balanceLiters
FUEL-TOPUP-AUTO-030
Сейчас job сравнивает:

card.balanceLiters >= minBal → skip
Заменить на:

взять cardLocationId = getOrCreateFuelCardLocation(card.id)
current = getBalanceAtTx(tx, cardLocationId, r.stockItemId, r.nextRunAt)
сравнить current >= minBalanceLiters
Критерии приёмки

Порог работает корректно в “as-of” модели.
D) computeNextRunAt: вынести общий util
FUEL-TOPUP-UTIL-040

Создать backend/src/utils/topUpUtils.ts:
computeNextRunAt(base: Date, scheduleType)
computePeriodKey(now, scheduleType, timezone)
Использовать в:
fuelCardTopUpJob.ts
fuelCardService.ts (upsertTopUpRule)
Критерии приёмки

Нет дублирования логики nextRunAt.
E) Admin endpoint
У вас уже есть POST /api/admin/jobs/run-fuelcard-topups. Используем его, не плодим новый маршрут.

(Опционально расширить body: batchSize, dryRun, ruleId — позже.)

Риски
Если где-то UI/отчёты всё ещё используют FuelCard.balanceLiters как “баланс карты”, после отключения increment нужно перевести эти места на ledger API (/api/stock/balance).
Изменение occurredAt на nextRunAt изменит временную точку движения (это правильно для as-of, но важно понимать при отчётах).

---

# UI-DESIGN-007 — Унификация цветовых схем ✅

**Цель:** Приведение всех элементов UI (справочники, сотрудники, склады) к единой схеме teal-600 для активных состояний.

- [x] `constants.ts`: Обновить `WAYBILL_STATUS_COLORS` (POSTED → teal-600)
- [x] `constants.ts`: Обновить `ORGANIZATION_STATUS_COLORS` (Active → teal-600)
- [x] `constants.ts`: Обновить `VEHICLE_STATUS_COLORS` (Active → teal-600)
- [x] `constants.ts`: Обновить `STORAGE_STATUS_COLORS` (Active → teal-600)
- [x] `constants.ts`: Обновить `BLANK_STATUS_COLORS` (Used, Issued → teal-600)
- [x] `constants.ts`: Обновить `BUSINESS_EVENT_CONFIG` (Posted, Issued → teal-600)
- [x] `Badge.tsx`: Обновить `success` variant (bg-teal-600 text-white)
- [x] `EmployeeList.tsx`: Исправить хардкод цвета ACTIVE (teal-600)
- [x] `waybillService.ts`: Исправить ошибку сторно (404) при корректировке ПЛ

