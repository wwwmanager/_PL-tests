# WB-FUELCARD-ROLL-OUT-004: Rollout Plan & Execution Order

## Стратегия

### Правильный порядок:
```
1. ✅ Frontend Integration (DONE)
2. ⏳ Manual Testing (15 min) ← START HERE
3. ⏳ Backfill Migration (Staging)
4. ⏳ Production Deployment
```

### Почему именно так?

**Проблема:** Backfill *изменяет данные* в базе.  
**Риск:** Если FE не передаёт `fuelCardId` или перетирает его, после backfill появятся новые "битые" ПЛ.  
**Решение:** Сначала тест → убедиться что код работает → потом backfill.

---

## Phase 1: Manual Testing (WB-FUELCARD-TEST-010)

**Время:** ~15 минут  
**Где:** Staging или локальная среда  
**Документ:** `docs/WB-FUELCARD-TEST-010.md`

### Quick Checklist

| # | Test Case | Priority | Status |
|---|-----------|----------|--------|
| 1 | Создание ПЛ → fuelCardId auto-fill | HIGH | ⬜ |
| 2 | Top-Up → POST успешен | HIGH | ⬜ |
| 3 | POST без fuelCardId → ошибка | HIGH | ⬜ |
| 4 | Редактирование → fuelCardId loaded | MEDIUM | ⬜ |

**Acceptance:**
- ✅ Все HIGH priority тесты пройдены
- ✅ Нет неожиданных ошибок в console/network

---

## Phase 2: Backfill Migration (WB-FUELCARD-MIG-020)

**Выполнять ТОЛЬКО после Phase 1!**

### Pre-flight Check

```bash
# 1. Убедиться что тесты пройдены
cat docs/WB-FUELCARD-TEST-010.md | grep "Status: ✅"

# 2. Проверить что на staging есть данные для backfill
psql -U postgres -d waybills_staging -c "
  SELECT COUNT(*) as affected_count
  FROM waybills w
  JOIN waybill_fuel wf ON wf.\"waybillId\" = w.id
  WHERE wf.\"sourceType\" = 'FUEL_CARD'
    AND w.\"fuelCardId\" IS NULL;
"

# Если affected_count = 0, backfill не нужен
```

### Execution

```cmd
# STAGING
cd c:\_PL-tests\backend
.\run-fuelcard-backfill.bat

# Скрипт выполнит:
# 1. Backup (автоматически)
# 2. Preview (показ affected records)
# 3. Confirmation prompt (ручное подтверждение)
# 4. Update (если подтверждено)
# 5. Verify (проверка результатов)
# 6. Orphans Report (сохранение)
```

### Post-migration Validation

**1. Spot-check исторических ПЛ:**
```sql
-- Выбрать 3 случайных ПЛ, которые были обновлены
SELECT 
  w.id,
  w.number,
  w.date,
  w."fuelCardId",
  fc."cardNumber",
  wf."sourceType"
FROM waybills w
JOIN waybill_fuel wf ON wf."waybillId" = w.id
LEFT JOIN fuel_cards fc ON fc.id = w."fuelCardId"
WHERE wf."sourceType" = 'FUEL_CARD'
ORDER BY RANDOM()
LIMIT 3;

-- Проверить: fuelCardId заполнен, cardNumber соответствует водителю
```

**2. Orphans Report Analysis:**
```
Файл: reports/step4_orphans_<timestamp>.txt

Проверить:
- Количество orphans (ожидается < 10% от affected)
- Причины (обычно: водитель уволен, карта не назначена)
- План действий:
  ✓ Если карта есть → назначить вручную
  ✓ Если карты нет → изменить sourceType на MANUAL
```

**3. Попробовать провести один из обновлённых ПЛ:**
```
1. Открыть исторический ПЛ (status = DRAFT, fuelCardId теперь заполнен)
2. Попытаться POST
3. Ожидаемый результат: либо успех, либо ошибка валидации (но НЕ FUEL_CARD_REQUIRED)
```

---

## Phase 3: Production Deployment

**Выполнять ТОЛЬКО после успешного backfill на staging!**

### Pre-deployment

- [ ] Staging backfill прошёл успешно
- [ ] Orphans Report проанализирован
- [ ] Manual testing на staging повторён
- [ ] Production backup создан

### Deployment

```bash
# 1. Deploy код (FE + BE)
git checkout main
git pull
# ... deploy process ...

# 2. Выполнить backfill на PROD (аналогично staging)
psql -U postgres -d waybills_prod
# ... run backfill script ...

# 3. Мониторинг
tail -f /var/log/waybills/app.log | grep "FUEL_CARD_REQUIRED"
```

### Monitoring

**Метрики для отслеживания (первые 24 часа):**
- Количество ошибок `FUEL_CARD_REQUIRED` (ожидается: только для orphans)
- Количество успешных POSTED с `sourceType='FUEL_CARD'`
- Время ответа API `/waybills/prefill`

---

## Rollback Plan

### Если тесты (Phase 1) провалились:

1. **НЕ выполнять backfill!**
2. Исправить FE integration
3. Повторить тесты

### Если backfill (Phase 2) создал проблемы:

1. **Restore from backup:**
   ```bash
   psql -U postgres -d waybills_staging < backup_pre_fuelcard_migration_<timestamp>.sql
   ```

2. **Analyze проблему:**
   - Проверить orphans report
   - Проверить логи backend

3. **Fix и повторить:**
   - Исправить SQL скрипт (если проблема в логике)
   - Или исправить FE (если fuelCardId перезаписывается)

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Manual Testing | 15 min | FE integration complete |
| Backfill (Staging) | 10 min | Tests passed |
| Validation | 15 min | Backfill complete |
| Production | 30 min | Staging validated |

**Total:** ~70 минут (1 час 10 минут)

---

## Success Criteria

### Short-term (После backfill)
- ✅ Все affected ПЛ получили `fuelCardId` (кроме orphans)
- ✅ Orphans report документирован
- ✅ Spot-check показывает корректные данные

### Long-term (После deployment)
- ✅ Нет ошибок `FUEL_CARD_REQUIRED` для новых ПЛ
- ✅ Проведение ПЛ с `sourceType='FUEL_CARD'` работает стабильно
- ✅ Ledger movements корректны (TRANSFER card→tank + EXPENSE)

---

**Автор:** Backend Team  
**Дата:** 2025-12-24  
**Статус:** Ready for Phase 1 (Manual Testing)
