# WB-FUELCARD-TEST-010: Manual Testing Checklist

## Цель
Проверить FE интеграцию `fuelCardId` перед backfill миграцией, чтобы избежать создания новых "битых" ПЛ.

**Время:** ~15 минут  
**Среда:** Staging или локальная разработка

---

## Pre-requisites

**Тестовые данные:**
- ✅ Водитель с назначенной топливной картой
- ✅ Водитель БЕЗ топливной карты
- ✅ ТС с привязанным водителем
- ✅ Баланс на топливной карте ≥ 50L

**Проверка backend:**
```bash
# Убедиться что backend запущен и работает
curl http://localhost:3000/api/health
```

---

## Test Case 1: Создание нового ПЛ с автоматическим fuelCardId

### Шаги:
1. **Открыть форму создания ПЛ**
   - Нажать "Создать путевой лист"

2. **Выбрать ТС с водителем у которого ЕСТЬ карта**
   - Выбрать vehicle → водитель автоматически подставляется
   - **Ожидаемое:** Prefill отработал

3. **Проверить fuelCardId в React DevTools**
   ```
   Components → WaybillDetail → hooks → formData
   ✅ formData.fuelCardId должен быть заполнен (UUID)
   ```

4. **Заполнить минимальные данные:**
   - Дата: сегодня
   - Одометр начало/конец: любые значения
   - Топливо (заправка): 30L
   - Source Type: FUEL_CARD

5. **Сохранить ПЛ**
   - Нажать "Сохранить"
   - **Ожидаемое:** Успешное сохранение

6. **Проверить payload в Network tab:**
   ```
   POST /api/waybills
   Request Payload:
   {
     "vehicleId": "...",
     "driverId": "...",
     "fuelCardId": "xxx-xxx-xxx", // ✅ Должен быть!
     ...
   }
   ```

### Acceptance Criteria:
- ✅ `formData.fuelCardId` заполнен после prefill
- ✅ Payload содержит `fuelCardId`
- ✅ ПЛ успешно сохранён

---

## Test Case 2: Top-Up → Проведение ПЛ

### Pre-requisite:
- Создан ПЛ из Test Case 1 (status = DRAFT, fuelCardId заполнен)
- Дата заправки в ПЛ: например, 2025-12-24 10:00

### Шаги:

1. **Создать Top-Up для топливной карты**
   ```
   Warehouse → Fuel Cards → [Выбрать карту] → Top-Up
   
   Параметры:
   - Количество: 100L
   - Дата: 2025-12-24 08:00 (ДО заправки в ПЛ!)
   - StockItemId: тот же что и в ПЛ
   ```

2. **Провести Top-Up**
   - Нажать "Создать"
   - **Ожидаемое:** Top-Up успешно создан

3. **Вернуться к ПЛ и провести его (POSTED)**
   - Открыть ПЛ из Test Case 1
   - Нажать "Провести" (POSTED)
   - **Ожидаемое:** Успешное проведение

4. **Проверить созданные движения:**
   ```sql
   SELECT 
     movementType, 
     quantity, 
     fromStockLocationId, 
     toStockLocationId,
     comment
   FROM stock_movements
   WHERE documentType = 'WAYBILL' 
     AND documentId = '<waybill_id>'
   ORDER BY "occurredAt";
   ```

   **Ожидаемые результаты:**
   ```
   TRANSFER | 30.0 | <fuel_card_location> | <vehicle_tank_location> | "Заправка по ПЛ №..."
   EXPENSE  | 25.X | <vehicle_tank_location> | NULL | "Расход по ПЛ №..."
   ```

### Acceptance Criteria:
- ✅ ПЛ успешно проведён (status = POSTED)
- ✅ Создано 2 движения: TRANSFER (card→tank) и EXPENSE (tank→consumption)
- ✅ Баланс карты уменьшился на 30L
- ✅ Нет ошибки `FUEL_CARD_REQUIRED`

---

## Test Case 3: Проведение БЕЗ fuelCardId (Negative Test)

### Цель:
Проверить что backend валидация работает корректно.

### Шаги:

1. **Создать новый ПЛ с водителем БЕЗ карты**
   - Создать ПЛ
   - Выбрать водителя у которого НЕТ топливной карты
   - **Ожидаемое:** `formData.fuelCardId` = null или пусто

2. **Заполнить данные с sourceType='FUEL_CARD':**
   - Топливо (заправка): 20L
   - Source Type: FUEL_CARD (**внимание: противоречие!**)

3. **Сохранить и попытаться провести:**
   - Сохранить ПЛ → успех
   - Провести (POSTED) → **должна быть ошибка!**

4. **Ожидаемая ошибка:**
   ```
   Error 400: Для заправки с топливной карты выберите карту в путевом листе
   Code: FUEL_CARD_REQUIRED
   ```

### Acceptance Criteria:
- ✅ Сохранение ПЛ БЕЗ `fuelCardId` проходит
- ✅ Проведение ПЛ с `sourceType='FUEL_CARD'` БЕЗ `fuelCardId` **падает** с ошибкой `FUEL_CARD_REQUIRED`
- ✅ Ошибка отображается в UI

---

## Test Case 4: Редактирование существующего ПЛ

### Шаги:

1. **Открыть ПЛ из Test Case 1 (уже проведённый)**
   - **Ожидаемое:** Status = POSTED, редактирование заблокировано

2. **Вернуть ПЛ в DRAFT** (если есть такая возможность)
   - Или создать новый ПЛ и сохранить его

3. **Открыть сохранённый ПЛ для редактирования:**
   - **Проверить:** `formData.fuelCardId` должен быть загружен из БД

4. **Проверить в React DevTools:**
   ```
   Components → WaybillDetail → hooks → formData
   ✅ formData.fuelCardId = "<uuid>" (тот же что был при создании)
   ```

### Acceptance Criteria:
- ✅ `fuelCardId` корректно загружается при редактировании ПЛ
- ✅ Значение совпадает с тем что было сохранено

---

## Checklist Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: Создание с auto-fill | ⬜ | fuelCardId в formData и payload |
| TC2: Top-Up → POSTED | ⬜ | Движения созданы, нет ошибок |
| TC3: POSTED без fuelCardId | ⬜ | Ошибка FUEL_CARD_REQUIRED |
| TC4: Редактирование | ⬜ | fuelCardId загружается из БД |

---

## Troubleshooting

### Issue: fuelCardId не заполняется в formData

**Проверить:**
1. Prefill API возвращает `fuelCardId`:
   ```
   Network tab → GET /api/waybills/prefill?vehicleId=xxx
   Response должен содержать: { fuelCardId: "...", ... }
   ```

2. У водителя назначена активная карта:
   ```sql
   SELECT * FROM fuel_cards 
   WHERE "assignedToDriverId" = '<driver_id>' 
     AND "isActive" = true;
   ```

3. `applyPrefill` вызывается:
   - Добавить `console.log` в `applyPrefill` функцию
   - Проверить что `data.fuelCardId` не null

### Issue: Payload не содержит fuelCardId

**Проверить:**
1. `formData` spread включает все поля:
   ```typescript
   const payload = { ...formData, ... };
   console.log('Payload:', payload.fuelCardId);
   ```

2. Нет перезаписи `fuelCardId` на `undefined`:
   - Поискать в коде: `fuelCardId: undefined` или `fuelCardId: ''`

---

**Автор:** Backend Team  
**Дата:** 2025-12-24  
**Статус:** Ready for Execution
