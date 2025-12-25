# Fuel Card Chronology Control

## Временные ограничения при работе с топливными картами

### Основное правило

При проведении путевого листа (POSTED) с заправкой с топливной карты (`sourceType='FUEL_CARD'`) должно соблюдаться:

```
topup.occurredAt <= refuel.refueledAt
```

**Обоснование:** Это корректно по бухгалтерскому учету — нельзя заправить топливо с карты **раньше**, чем эта карта была пополнена.

---

## Примеры сценариев

### ✅ Корректный сценарий

```
1. 2025-12-20 08:00 - Top-Up: Карта пополнена на 100L
2. 2025-12-20 10:00 - Refuel: Заправка 30L с карты
3. 2025-12-20 18:00 - Expense: Расход 25L при проведении ПЛ
```

**Хронология соблюдена:**
- `topup.occurredAt (08:00) <= refuel.refueledAt (10:00)` ✅

---

### ❌ Некорректный сценарий

```
1. 2025-12-20 12:00 - Top-Up: Карта пополнена на 100L
2. 2025-12-20 10:00 - Refuel: Заправка 30L с карты (ДО пополнения!)
```

**Ошибка:**
- `topup.occurredAt (12:00) > refuel.refueledAt (10:00)` ❌
- **Баланс на момент 10:00 был недостаточен**

---

## Текущая реализация (commit 9f77a09)

### Что уже работает

1. **Привязка карты:**
   - `Waybill.fuelCardId` автоматически заполняется по водителю
   - Валидация `FUEL_CARD_REQUIRED` при проведении

2. **Ledger движения:**
   ```
   TRANSFER: FUEL_CARD → VEHICLE_TANK (occurredAt = refueledAt)
   EXPENSE: VEHICLE_TANK → consumption (occurredAt = endAt)
   ```

### Что НЕ проверяется (пока)

❌ **Chronology validation:** Проверка `topup.occurredAt <= refuel.refueledAt`

**Следствие:** Если карта была пополнена ПОСЛЕ заправки, проведение ПЛ всё равно пройдёт, но ledger будет некорректен (отрицательный баланс в прошлом).

---

## Будущая имплементация

### Тикет: WB-CHRONOLOGY-VAL-001

**Приоритет:** Low (не блокирует текущий фикс)

**Задача:** Добавить валидацию при проведении ПЛ:

```typescript
// В changeWaybillStatus() перед созданием TRANSFER
if (status === WaybillStatus.POSTED) {
    for (const fuelLine of waybill.fuelLines) {
        if (fuelLine.sourceType === 'FUEL_CARD' && waybill.fuelCardId) {
            const refueledAt = fuelLine.refueledAt || waybill.startAt || waybill.date;
            
            // Найти последний Top-Up ДО или в момент заправки
            const lastTopUp = await prisma.fuelCardTransaction.findFirst({
                where: {
                    fuelCardId: waybill.fuelCardId,
                    type: 'TOPUP',
                    occurredAt: { lte: refueledAt }
                },
                orderBy: { occurredAt: 'desc' }
            });
            
            if (!lastTopUp) {
                throw new BadRequestError(
                    `Карта не была пополнена до момента заправки (${refueledAt.toISOString()})`,
                    'FUEL_CARD_NOT_TOPPED_UP_YET'
                );
            }
            
            // Опционально: проверить достаточность баланса на момент заправки
            const balanceAtRefuel = await getBalanceAt(
                fuelCardLocation.id,
                fuelLine.stockItemId,
                refueledAt
            );
            
            if (balanceAtRefuel < fuelLine.fuelReceived) {
                throw new BadRequestError(
                    `Недостаточно топлива на карте на момент заправки (баланс: ${balanceAtRefuel}L, требуется: ${fuelLine.fuelReceived}L)`,
                    'INSUFFICIENT_FUEL_CARD_BALANCE_AT_REFUEL'
                );
            }
        }
    }
}
```

---

## Обходное решение (временное)

**До имплементации валидации:**

1. **При создании Top-Up:** Убедиться что `occurredAt` указан корректно (дата пополнения)
2. **При создании ПЛ:** Указывать `refueledAt` или полагаться на `startAt` (обычно корректно)
3. **При проведении:** Если возникает ошибка недостатка топлива → проверить хронологию вручную

---

## FAQ

### Q: Что делать если Top-Up был создан с неправильной датой?

**A:** Исправить `occurredAt` для Top-Up транзакции:
```sql
UPDATE fuel_card_transactions
SET "occurredAt" = '2025-12-20 08:00:00'
WHERE id = 'topup-uuid';
```

### Q: Можно ли провести ПЛ без Top-Up?

**A:** Да, если карта уже имеет баланс. Но корректнее всегда иметь явный Top-Up перед заправкой.

### Q: Как узнать баланс карты на конкретную дату?

**A:** Использовать `getBalanceAt()`:
```typescript
const balance = await getBalanceAt(
    fuelCardLocation.id,
    stockItemId,
    new Date('2025-12-20T10:00:00')
);
```

---

## Связанные документы

- [FUEL_CARD_INTEGRATION_REPORT.md](file:///c:/_PL-tests/backend/docs/FUEL_CARD_INTEGRATION_REPORT.md)
- [migration-backfill-fuelcard.sql](file:///c:/_PL-tests/backend/docs/migration-backfill-fuelcard.sql)

---

**Дата:** 2025-12-23  
**Статус:** Документация (имплементация валидации — будущая задача)
