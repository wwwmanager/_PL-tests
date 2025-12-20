# Fuel Cards Auto Top-Up — Эксплуатация

## Обзор

Система автоматического пополнения топливных карт позволяет настроить правила периодического пополнения баланса карт по расписанию.

## Ключевые сущности

### FuelCardTopUpRule (Правило автопополнения)

| Поле | Описание |
|------|----------|
| `fuelCardId` | ID топливной карты |
| `scheduleType` | Тип расписания: `DAILY`, `WEEKLY`, `MONTHLY` |
| `amountLiters` | Сумма пополнения (литры) |
| `minBalanceLiters` | Порог баланса (опционально) — пополнение только если баланс ниже этого значения |
| `timezone` | Часовой пояс (по умолчанию `Europe/Moscow`) |
| `nextRunAt` | Следующее время выполнения |
| `isActive` | Активно ли правило |

### FuelCardTransaction (Транзакция)

| Поле | Описание |
|------|----------|
| `type` | Тип: `TOPUP`, `ADJUSTMENT`, `DEBIT` |
| `amountLiters` | Сумма транзакции |
| `periodKey` | Ключ периода (защита от дублей) |
| `reason` | Причина (`AUTO_TOPUP` для автопополнений) |

---

## Как работает periodKey (защита от дублей)

`periodKey` — это строковый ключ, который генерируется на основе типа расписания:

| scheduleType | Формат periodKey | Пример |
|--------------|------------------|--------|
| `DAILY` | `YYYY-MM-DD` | `2025-12-20` |
| `WEEKLY` | `YYYY-Www` | `2025-W51` |
| `MONTHLY` | `YYYY-MM` | `2025-12` |

**Уникальный индекс**: `[organizationId, fuelCardId, type, periodKey]`

Это означает:
- Для одной карты в одном периоде может быть только **один TOPUP**
- Повторный запуск job'а в том же периоде не создаёт дублей
- Разные организации могут иметь одинаковый periodKey (изоляция)

---

## Как работает порог minBalanceLiters

Если у правила задан `minBalanceLiters`:
- Пополнение происходит **только если баланс < порога**
- Если баланс >= порога, запись пропускается (skipped), но `nextRunAt` сдвигается
- Это позволяет не переполнять карты при частых начислениях

**Пример**:
```
minBalanceLiters = 30
amountLiters = 10

Баланс 50 → пропуск (50 >= 30)
Баланс 25 → пополнение до 35 (25 < 30)
```

---

## Запуск Job

### Автоматический (scheduler)

Переменные окружения:

```bash
# Включить планировщик
ENABLE_SCHEDULERS=true

# Интервал между запусками (мс, по умолчанию 60000 = 1 минута)
FUEL_TOPUP_INTERVAL_MS=60000

# Использовать advisory lock для multi-instance (по умолчанию true)
USE_ADVISORY_LOCK=true

# Запустить сразу при старте сервера (опционально)
SCHEDULER_RUN_ON_START=true
```

### Ручной (admin endpoint)

```bash
curl -X POST http://localhost:3000/api/admin/jobs/run-fuelcard-topups \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

**Ответ**:
```json
{
  "success": true,
  "requestId": "abc-123",
  "durationMs": 45,
  "processed": 5,
  "toppedUp": 3,
  "skipped": 2,
  "errors": []
}
```

**Доступ**: только роль `admin`

---

## Troubleshooting

### Почему карта не пополнилась?

1. **Проверьте `isActive` правила**
   ```sql
   SELECT * FROM fuel_card_topup_rules WHERE fuel_card_id = '<id>';
   ```

2. **Проверьте `nextRunAt`**
   - Если `nextRunAt > NOW()`, правило ещё не подошло
   
3. **Проверьте порог `minBalanceLiters`**
   ```sql
   SELECT r.min_balance_liters, c.balance_liters
   FROM fuel_card_topup_rules r
   JOIN fuel_cards c ON c.id = r.fuel_card_id
   WHERE r.id = '<rule_id>';
   ```
   - Если `balance_liters >= min_balance_liters`, пополнение пропущено

4. **Проверьте, была ли уже транзакция в этом периоде**
   ```sql
   SELECT * FROM fuel_card_transactions 
   WHERE fuel_card_id = '<id>' 
     AND type = 'TOPUP' 
     AND period_key = '2025-12-20';
   ```

5. **Проверьте активность карты**
   ```sql
   SELECT is_active FROM fuel_cards WHERE id = '<id>';
   ```

6. **Проверьте логи по requestId**
   ```sql
   SELECT * FROM audit_log 
   WHERE entity_type = 'JOB' 
   ORDER BY created_at DESC LIMIT 10;
   ```

### Job выполняется, но ничего не обрабатывает

- Scheduler выключен: проверьте `ENABLE_SCHEDULERS=true`
- Нет правил с `nextRunAt <= NOW()`
- Все правила неактивны

### Дубли транзакций

Теоретически невозможны из-за unique constraint на `periodKey`. Если видите дубли:
- Проверьте, не различаются ли `periodKey` (разные дни/недели)
- Проверьте, не являются ли транзакции из разных org

---

## Multi-Instance (несколько серверов)

При запуске нескольких инстансов приложения:

1. **Advisory Lock** (`USE_ADVISORY_LOCK=true`) гарантирует, что только один инстанс выполняет job одновременно
2. **FOR UPDATE SKIP LOCKED** в SQL предотвращает обработку одного правила двумя процессами
3. **Unique constraint** на `periodKey` — последняя линия защиты от дублей

---

## Мониторинг

### AuditLog

Каждый ручной запуск job'а записывается в `audit_log`:

```sql
SELECT 
  created_at,
  description,
  new_value->>'processed' as processed,
  new_value->>'toppedUp' as topped_up,
  new_value->>'durationMs' as duration_ms,
  new_value->>'requestId' as request_id
FROM audit_log 
WHERE entity_type = 'JOB'
ORDER BY created_at DESC;
```

### Scheduler Status

Для диагностики можно вызвать `getSchedulerStatus()` (доступно программно):

```typescript
import { getSchedulerStatus } from './jobs/scheduler';
console.log(getSchedulerStatus());
// { enabled: true, fuelTopUpRunning: false, fuelTopUpIntervalMs: 60000, useAdvisoryLock: true }
```

---

## Checklist перед production

- [ ] `ENABLE_SCHEDULERS=true` в production env
- [ ] `FUEL_TOPUP_INTERVAL_MS` настроен (60000 для 1 мин, 300000 для 5 мин)
- [ ] Правила созданы через API или миграцию
- [ ] `timezone` правил соответствует бизнес-таймзоне
- [ ] AuditLog периодически проверяется
- [ ] Логи сервера мониторятся на ошибки `[Scheduler]`
