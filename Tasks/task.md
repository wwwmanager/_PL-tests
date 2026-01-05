# Список задач - Исправление консистентности ПЛ

- [ ] **DATA-FIX-001**: Исправление разрывов в цепочках Путевых Листов
    - [ ] Найти проблемные ПЛ (№ЧБ 000015, 000016, 000019) и связанное ТС
    - [ ] Проанализировать цепочку (пробег, топливо)
    - [ ] Предложить решение (скрипт исправления или ручное удаление старых данных)
    - [ ] Применить исправление

- [x] **WB-BATCH-FIX-001**: Исправление расхождения пробега в пакетной загрузке
    - [x] Найдена причина: сумма округлённых по дням != округление суммы
    - [x] `createWaybillFromGroup` теперь возвращает `usedDistance` и `usedConsumption`
    - [x] Running totals используют те же значения, что и waybill

- [x] **WB-BATCH-CHAIN-001**: Автоматическое продолжение цепочки ПЛ
    - [x] Пакетная загрузка теперь берёт начальные значения из последнего ПЛ (любой статус)
    - [x] Если ПЛ нет — используются значения из справочника ТС
    - [x] Пользователь подтвердил работу

- [x] **WB-CHAIN-INTEGRITY-001**: Валидация целостности цепочки при проведении
    - [x] Backend проверяет наличие непроведённых ПЛ с более ранней датой
    - [x] Если есть — блокирует проведение с сообщением о конкретных ПЛ

- [x] **WB-BATCH-FIX-002**: Исправление накопления ошибок floating-point
    - [x] `runningFuel` теперь округляется после каждого обновления
    - [x] Устранена причина расхождения в 0.01 л между расчётом и записью

#- [x] **BUG-HIERARCHY-001**: Fix Organization Hierarchy Inheritance
    - [x] Investigate why child organization vehicles are missing in `stockController`. <!-- id: 241 -->
    - [x] Implement recursive organization lookup in `listStockLocations`. <!-- id: 242 -->
    - [x] Verify fix with user. <!-- id: 243 -->
- [x] **UI-STOCK-002**: Improve Waybill Expense Display
    - [x] Update `FuelMovements.tsx` to show Vehicle instead of Recipient ID for Waybill expenses. <!-- id: 244 -->
    - [/] Verify fix with user. <!-- id: 245 -->
- [x] **DATA-FIX-001**: Fix Waybill Data Consistency & Admin Visibility
    - [x] Analyze `analyze_vehicle_chain.ts` to find conflicting data.
    - [x] Fix `adminController.ts` limits to ensure all data is visible for cleanup.
    - [x] User verified data is clean.
- [x] **FEAT-BLANKS-001**: Blank Restoration
    - [x] Update `blankService.ts` to support restoring spoiled blanks.
    - [x] Update `BlankManagement.tsx` to add Restore button for spoiled blanks.
    - [ ] User Verification.
