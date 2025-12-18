# Анализ доменной логики Путевых Листов (Waybill)

## 1. Статусы и переходы

- **Enum (Prisma)**: Предположительно `WaybillStatus` (DRAFT, SUBMITTED, POSTED, CANCELLED).
- **Enum (Frontend)**: `WaybillStatus` (Draft, Active, Completed, Posted, Cancelled) + маппинг.
- **Реализация canTransition на backend**:
    - **Нет**, отсутствует отдельная функция `canTransition`.
    - Логика "зашита" прямо в `changeWaybillStatus` (файл `backend/src/services/waybillService.ts`, строки 239-244).
    - Таблица переходов hardcoded внутри метода и совпадает с frontend лишь частично (упрощена).
- **Использование в waybillService**: Да, проверка выполняется перед сменой статуса.

## 2. Расчёт топлива и одометра

- **calculateNormConsumption**:
    - **frontend**: `services/domain/waybill.ts` (есть).
    - **backend**: **Нет**. Сервис `createWaybill` ожидает готовые `fuelLines` с рассчитанными значениями.
    - **используется в service**: Нет.

- **calculateFuelEnd**:
    - **frontend**: `services/domain/waybill.ts` (есть).
    - **backend**: **Нет**. Бэкенд сохраняет то, что прислал фронт.

## 3. Определение зимнего периода (isWinterDate)

- **frontend**: `services/dateUtils.ts` (есть).
- **backend**:
    - **Аналог**: **Нет**. Логика определения зимы отсутствует.
    - **Хранение SeasonSettings**: Сервис `backend/src/services/settingsService.ts` умеет читать/писать настройки (в модель `Setting` ключ `season_settings`), но **не использует** их для расчетов в `waybillService`.

## 4. Интеграция в waybillService

- **createWaybill** (`backend/src/services/waybillService.ts`):
    - **Доменные проверки**: Минимальные.
        - Существование авто/водителя/бланка.
        - Бланк принадлежит тому же подразделению, что и авто.
    - **Расчёты**: Отсутствуют. Пробег и топливо сохраняются "как есть" из входных данных.
    - **Валидация**: Нет проверок `odometerEnd >= odometerStart`.

- **changeStatus** (`backend/src/services/waybillService.ts`):
    - **Проверки**: Проверка по таблице переходов (`allowedTransitions`).
    - **Логика при переходе в POSTED**:
        - **Склад**: Создаются движения расхода (`createExpenseMovement`).
        - **Бланки**: Обновляется статус бланка (`ISSUED` -> `USED`).
        - **Аудит**: Записывается `AuditLog`.

## 5. Выводы и рекомендации

### Что уже перенесено на backend и используется корректно
1.  **RBAC и проверки доступа**: Владение бланком, существование сущностей.
2.  **Side-effects при проведении (POSTED)**: Списание топлива со склада и погашение бланков реализовано корректно.
3.  **Базовая машина состояний**: Есть защита от некорректных переходов (хоть и hardcoded).

### Что пока живёт только на фронте и требует переноса
1.  **Расчет нормативного расхода**: Вся логика (`calculateNormConsumption`) полностью на клиенте. Backend слепо доверяет клиенту.
2.  **Сезонность**: Backend не знает, является ли дата "зимней", и не применяет коэффициенты.
3.  **Валидация целостности**: Нет проверки математики (Начало + Заправка - Расход = Конец).

### Предложенный порядок переноса
1.  **Перенос `calculateNormConsumption` и `isWinterDate`**:
    - Создать `backend/src/domain/waybill.ts` (портировать с фронта).
    - Создать `backend/src/utils/dateUtils.ts` (портировать `isWinterDate`).
2.  **Усиление `createWaybill` / `updateWaybill`**:
    - Добавить валидацию: если прислали `fuelConsumed`, проверить, соответствует ли он норме (или хотя бы не превышает лимиты).
    - Добавить валидацию одометра.
3.  **Refactor Status Machine**:
    - Вынести `allowedTransitions` и логику `canTransition` в отдельный доменный модуль для переиспользования.
