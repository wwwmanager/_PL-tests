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