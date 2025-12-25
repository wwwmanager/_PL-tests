# WB-FUELCARD-TEST-010: Manual Testing Results

**Дата:** 2025-12-24  
**Тестировщик:** _________________  
**Среда:** ☐ Local ☐ Staging ☐ Production

---

## Pre-requisites Check

- [ ] Backend запущен (http://localhost:3000)
- [ ] Frontend запущен (http://localhost:5173)
- [ ] Есть тестовый водитель с топливной картой
- [ ] Есть тестовый водитель БЕЗ топливной карты

---

## Test Case 1: Создание ПЛ с auto-fill fuelCardId

**Статус:** ☐ PASS ☐ FAIL

### Шаги:
1. ☐ Открыть форму "Создать путевой лист"
2. ☐ Выбрать ТС с водителем (у которого есть карта)
3. ☐ Проверить formData.fuelCardId в React DevTools

**Результат:**
- fuelCardId в formData: `_______________________` (UUID или пусто)
- Payload в Network включает fuelCardId: ☐ ДА ☐ НЕТ

**Screenshot/Evidence:**
```
Network → POST /api/waybills
Request Payload:
{
  "vehicleId": "...",
  "driverId": "...",
  "fuelCardId": "________________", // <-- заполнить
  ...
}
```

**Notes:**
```
__________________________________________________________________
```

---

## Test Case 2: Top-Up → POSTED

**Статус:** ☐ PASS ☐ FAIL

### Pre-condition:
- ☐ ПЛ из TC1 создан (ID: `_________________`)
- ☐ Top-Up выполнен (Дата: `_________`, Количество: `_____L`)

### Шаги:
1. ☐ Создать Top-Up для карты (occurredAt РАНЬШЕ чем refueledAt в ПЛ)
2. ☐ Открыть ПЛ из TC1
3. ☐ Провести (POSTED)

**Результат:**
- Status после POSTED: ☐ POSTED ☐ ERROR
- Ошибка (если есть): `_______________________________________`

**Проверка движений:**
```sql
SELECT movementType, quantity, comment
FROM stock_movements
WHERE documentType = 'WAYBILL' AND documentId = '_______________';

-- Результат:
-- Row 1: TRANSFER | _____L | Заправка по ПЛ №___
-- Row 2: EXPENSE  | _____L | Расход по ПЛ №___
```

**Notes:**
```
__________________________________________________________________
```

---

## Test Case 3: POSTED без fuelCardId (Negative Test)

**Статус:** ☐ PASS ☐ FAIL

### Шаги:
1. ☐ Создать ПЛ с водителем БЕЗ карты
2. ☐ Заполнить данные, sourceType='FUEL_CARD'
3. ☐ Сохранить (должно пройти)
4. ☐ Попытаться провести (POSTED)

**Результат:**
- Ошибка получена: ☐ ДА ☐ НЕТ
- Код ошибки: `_______________________` (ожидается: FUEL_CARD_REQUIRED)
- Сообщение: `_________________________________________________`

**Expected:**
```
Error 400: Для заправки с топливной карты выберите карту в путевом листе
Code: FUEL_CARD_REQUIRED
```

**Notes:**
```
__________________________________________________________________
```

---

## Test Case 4: Редактирование существующего ПЛ

**Статус:** ☐ PASS ☐ FAIL

### Шаги:
1. ☐ Открыть ПЛ из TC1 для редактирования
2. ☐ Проверить formData.fuelCardId в React DevTools

**Результат:**
- fuelCardId загружен из БД: ☐ ДА ☐ НЕТ
- Значение совпадает с сохранённым: ☐ ДА ☐ НЕТ

**Notes:**
```
__________________________________________________________________
```

---

## Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: Auto-fill | ☐ PASS ☐ FAIL | |
| TC2: POSTED | ☐ PASS ☐ FAIL | |
| TC3: Negative | ☐ PASS ☐ FAIL | |
| TC4: Edit | ☐ PASS ☐ FAIL | |

**Overall Result:** ☐ ALL PASS ☐ SOME FAILURES

---

## Decision

☐ **PROCEED TO BACKFILL** (все тесты пройдены)  
☐ **FIX REQUIRED** (есть провалы, нужно исправление)

**Signature:** _________________  
**Date:** _________________

---

## Для автоматического заполнения (после выполнения):

Если все тесты **PASS**, скопировать результаты в:
`docs/WB-FUELCARD-TEST-RESULTS-<YYYYMMDD>.md`
