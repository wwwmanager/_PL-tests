# Аудит расчётов топлива: Отлов нарушителей SSOT

**Дата:** 2026-01-06  
**Канонический модуль:** `services/fuelCalculationService.ts`

---

## 1. Реестр расчётов (таблица)

| ID | Файл / функция | Тип | Что считает | Входы/выходы | Где используется | Статус |
|----|----------------|-----|-------------|--------------|------------------|--------|
| **CALC-001** | `services/fuelCalculationService.ts` → `calculatePlannedFuelByMethod` | FE | Плановый расход (BOILER/SEGMENTS/MIXED) | routes, vehicleRates, seasonSettings → plannedFuel, totalDistance | `batchWaybillService.ts:175`, `WaybillCheckModal.tsx:147`, `WaybillDetail.tsx:556` | **CANONICAL** |
| **CALC-002** | `services/fuelCalculationService.ts` → `calculateBoiler` | FE | Расход без коэффициентов | routes, rates → distance, consumption | Внутренний (через calculateFuel) | **CANONICAL** |
| **CALC-003** | `services/fuelCalculationService.ts` → `calculateSegments` | FE | Расход с коэффициентами по отрезкам | routes, rates → distance, consumption | Внутренний | **CANONICAL** |
| **CALC-004** | `services/fuelCalculationService.ts` → `calculateMixed` | FE | Усреднённый расход → одометр | routes, rates, odometerDistance → consumption | Внутренний | **CANONICAL** |
| **CALC-005** | `services/fuelCalculationService.ts` → `calculateFuelEnd` | FE | Остаток топлива | start, filled, consumed → fuelEnd | WaybillCheckModal | **CANONICAL** |
| **CALC-006** | `backend/src/domain/waybill/fuel.ts` → `calculatePlannedFuelByMethod` | BE | Плановый расход (BOILER/SEGMENTS/MIXED) | method, **baseRate**, segments, rates → number | `waybillService.ts:440`, `:764`, `:1843` | **DUPLICATE** |
| **CALC-007** | `backend/src/domain/waybill/fuel.ts` → `calculateNormConsumption` | BE | Нормативный расход | distanceKm, baseRate, coefficients → number | `fuel.ts:128`, `:145`, `:154` | **DUPLICATE** |
| **CALC-008** | `backend/src/domain/waybill/fuel.ts` → `calculateFuelEnd` | BE | Остаток топлива | start, received, consumed → number | `fuel.ts:276` | **DUPLICATE** |
| **CALC-009** | `services/domain/waybill.ts` → `calculateNormConsumption` | FE | Нормативный расход | distanceKm, baseRate, coefficients → number | `waybillCalculations.ts:37`, `:81` | **DUPLICATE** |
| **CALC-010** | `services/domain/waybill.ts` → `calculateFuelEnd` | FE | Остаток топлива | start, filled, consumed → number | Не используется в основном коде | **DUPLICATE** |
| **CALC-011** | `services/waybillCalculations.ts` → `calculateFuelConsumption` | FE | Расход по отрезкам | routes, vehicle, seasonSettings → number | Не используется | **DUPLICATE** |
| **CALC-012** | `services/waybillCalculations.ts` → `calculateStats` | FE | Пробег + расход | routes, vehicle → {distance, consumption} | Не используется | **DUPLICATE** |
| **CALC-013** | `Innovations/domain/waybill/fuel.ts` → `calculateNormConsumption` | FE | Нормативный расход | distanceKm, baseRate, coefficients → number | Только в Innovations (прототип) | **LEGACY** |
| **CALC-014** | `Innovations/domain/waybill/fuel.ts` → `calculateFuelEnd` | FE | Остаток топлива | start, filled, consumed → number | Только в Innovations (прототип) | **LEGACY** |

---

## 2. Список нарушителей

### 🔴 DUPLICATE: Backend fuel.ts

**Файл:** `backend/src/domain/waybill/fuel.ts`

| Функция | Расхождение с каноном |
|---------|----------------------|
| `calculatePlannedFuelByMethod` | **Другая сигнатура**: требует `baseRate` извне, не принимает `vehicleRates`/`seasonSettings`/`dayMode`. Не определяет сезонность самостоятельно. |
| `calculateNormConsumption` | Идентичный алгоритм, но **дублирование кода** |
| `calculateFuelEnd` | Идентичный алгоритм, но **дублирование кода** |

**Где используется:**
- `waybillService.ts:3` — импорт
- `waybillService.ts:440` — createWaybill
- `waybillService.ts:764` — updateWaybill
- `waybillService.ts:1843` — bulkRecalculateFuel

---

### 🟡 DUPLICATE: services/waybillCalculations.ts

**Файл:** `services/waybillCalculations.ts`

Старый модуль расчётов, **не использует** `fuelCalculationService.ts`.

| Функция | Статус |
|---------|--------|
| `calculateFuelConsumption` | Дублирует логику SEGMENTS, вызывает `domain/waybill.ts` |
| `calculateStats` | Дублирует логику BOILER/SEGMENTS |
| `calculateDistance` | Простая функция, может быть заменена |

**Где используется:**
- Импортируется в `batchWaybillService.ts:6` (для типа `WaybillCalculationMethod`)
- Функции `calculateFuelConsumption` и `calculateStats` — **не вызываются**

---

### 🟡 DUPLICATE: services/domain/waybill.ts

**Файл:** `services/domain/waybill.ts`

| Функция | Расхождение |
|---------|-------------|
| `calculateNormConsumption` | Идентичный код с `fuelCalculationService.ts`, дублирование |
| `calculateFuelEnd` | Идентичный код, дублирование |

**Где используется:**
- `waybillCalculations.ts:3` — импорт
- `waybillCalculations.ts:37`, `:81` — вызовы

---

### ⚪ LEGACY: Innovations/*

Файлы в директории `Innovations/` — это **устаревший прототип**. Не используются в production.

- `Innovations/domain/waybill/fuel.ts`
- `Innovations/src/domain/waybill/fuel.ts`
- `Innovations/utils/waybillCalculations.ts`

---

## 3. Bypass: Расчёты "на месте"

### `WaybillDetail.tsx:520-530`
```typescript
const baseConsumptionRate = isWaybillWinter ? (rates.winterRate || 0) : (rates.summerRate || 0);
// ...
const baseRate = isWinter ? (rates.winterRate || 0) : (rates.summerRate || 0);
```
**Проблема:** Определение `baseRate` дублируется вместо использования функции из единого модуля.

### `WaybillCheckModal.tsx:122`
```typescript
const rates = vehicle.fuelConsumptionRates as any || { summerRate: 10, winterRate: 12 };
```
**Проблема:** Захардкоженные fallback-значения.

### `batchWaybillService.ts:168`
```typescript
isCityDriving: false,  // ← Всегда false!
isWarming: false,       // ← Всегда false!
```
**Проблема:** Коэффициенты город/прогрев **игнорируются** при пакетной загрузке.

---

## 4. Рекомендации (без правок кода)

### 4.1. Удалить/заменить дубликаты

1. **`backend/src/domain/waybill/fuel.ts`** → Синхронизировать с `fuelCalculationService.ts`:
   - Изменить сигнатуру `calculatePlannedFuelByMethod` на совместимую с FE
   - Или: портировать весь `fuelCalculationService.ts` на backend

2. **`services/domain/waybill.ts`** → Удалить, заменить импорты на `fuelCalculationService.ts`

3. **`services/waybillCalculations.ts`** → Удалить (функции не используются), оставить только тип `WaybillCalculationMethod`

### 4.2. Исправить bypass-расчёты

1. **`batchWaybillService.ts:168`** — передавать реальные флаги `isCityDriving`/`isWarming` из настроек ТС (если применимо к пакетной загрузке) — **требует согласования с пользователем**

### 4.3. Единая точка определения baseRate

**Предложение:** добавить в `fuelCalculationService.ts` функцию:
```typescript
export const getBaseRateForDate = (
    date: string, 
    rates: FuelRates, 
    seasonSettings: SeasonSettings
): number
```
И использовать её везде вместо inline-логики `isWinter ? winterRate : summerRate`.

---

## 5. Итоговая статистика

| Статус | Количество |
|--------|------------|
| CANONICAL | 5 |
| DUPLICATE | 7 |
| LEGACY | 2 |
| **Всего** | 14 |

---

**Следующий шаг:** Согласовать план унификации backend с пользователем (вариант 3b из правил APPLICATION_CONTEXT.md).
