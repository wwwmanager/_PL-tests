Контекст‑пак: waybill-app — текущее состояние после внедрения расчётов топлива и жизненного цикла бланков
1) Краткий обзор приложения
waybill-app — B2B SaaS для логистики (РФ), мульти‑организационный (изоляция по organizationId, частично по departmentId), с ключевыми доменами:

Путевые листы (ПЛ): создание/обновление/проведение, учет одометра и топлива, аудит.
БСО (бланки путевых листов): пачки/материализация, выдача водителям, резервирование под ПЛ, использование, списание.
Склад: движения ТМЦ (INCOME/EXPENSE/ADJUSTMENT), балансы, пересчёты.
Настройки: Setting key-value JSON, включая сезонность (season_settings).
RBAC: роли и permissions через RolePermission, проверка checkPermission.
Архитектура: React SPA (frontend) → REST API Node/Express/TS (backend) → PostgreSQL (Prisma).

2) Важные модели и перечисления (фактические)
2.1. WaybillStatus (в БД/Prisma)
4 статуса: DRAFT, SUBMITTED, POSTED, CANCELLED.
Переходы (зафиксированы):

DRAFT → SUBMITTED → POSTED
DRAFT/SUBMITTED → CANCELLED
POSTED финальный (редактирование запрещено).
Важно: фронтовые “Active/Completed” концептуально маппятся на SUBMITTED (если отдельного COMPLETED нет).

2.2. BlankStatus (в БД/Prisma)
AVAILABLE, ISSUED, RESERVED, USED, RETURNED, SPOILED.

2.3. Мульти‑организационность/изоляция
authMiddleware кладёт в req.user: { id, organizationId, departmentId, role }.
Большинство запросов скоупится по organizationId; часть логики учитывает departmentId (например, совпадение подразделения бланка и ТС).
3) Что было проблемой до работ
Расчёты топлива жили на фронте: backend принимал “как есть” fuelConsumed/fuelAtEnd/fuelPlanned, не мог пересчитать/валидировать.
Нормы расхода отсутствовали в БД: в Vehicle не было fuelConsumptionRates, что ломало перенос логики на backend.
Сезонность (зима) отсутствовала на backend: season_settings хранились, но не применялись.
Риск гонок и неконсистентности по бланкам: без полноценного reserve/release/use в backend легко было получить “двойное использование”.
POSTED имел сайд‑эффекты без транзакционной целостности: возможны частичные операции (склад списался, а статус/бланк нет).
RBAC на смену статуса был слишком широкий (waybill.approve на всё).
4) Что реализовано (итог по тикетам)
Все запланированные тикеты выполнены, тесты проходят, TS компилируется.

4.1. Миграции БД и ограничения (WB-101, WB-102, BLS-101, BLS-104)
Vehicle.fuelConsumptionRates (Json?) добавлен и используется как источник норм.
В Waybill добавлены isCityDriving, isWarming.
В WaybillFuel добавлено fuelPlanned.
Добавлен индекс для быстрого выбора “следующего” бланка: (organizationId, issuedToDriverId, status, series, number).
Добавлено ограничение: Waybill.blankId @unique (1 бланк не может быть в 2 ПЛ).
4.2. Vehicle API + frontend DTO (WB-201, WB-202)
Backend отдаёт/принимает fuelConsumptionRates через API.
Frontend vehicleApi.ts обновлён и теперь получает нормы из реального API (не из mock).
4.3. Сезонность и расчёты топлива на backend (WB-301, WB-302)
Реализован isWinterDate на backend под текущий формат SeasonSettings из settingsService.ts:
recurring (лето/зима по дням/месяцам)
manual (ручные даты)
Реализован доменный модуль расчёта топлива (planned) и проверок:
вычисление planned расхода по нормам ТС + флаги isCityDriving/isWarming
валидация баланса топлива (start + received − consumed ≈ end) с допуском
округления/числовые защиты
4.4. DTO‑валидация и совместимость payload (WB-401)
waybillController больше не прокидывает “req.body as any” без проверок.
Сохранили обратную совместимость с legacy payload от фронта:
top-level fuelAtStart / fuelFilled / fuelAtEnd / fuelPlanned маппится в fuelLines[0] (и/или нормализуется в структуру сервиса).
4.5. WaybillService: расчёты, update, запреты POSTED (WB-402, WB-403)
createWaybill: валидирует одометр и топливо, считает fuelPlanned на backend (если нормы доступны), сохраняет в WaybillFuel.
updateWaybill: обновляет fuelLines (replace), пересчитывает planned, запрещает изменения для POSTED.
4.6. Полный жизненный цикл бланка на backend (BLS-201, BLS-202)
Реализованы атомарные операции бланков:

reserve next (выбор следующего ISSUED по номеру под водителя) с защитой от гонок
reserve specific / release / use / spoil
Интеграция с CRUD путевых листов:

При создании/изменении ПЛ бланк резервируется (ISSUED → RESERVED) и привязывается к ПЛ.
При удалении/отмене черновика бланк освобождается (RESERVED → ISSUED).
При проведении (POSTED) бланк переводится в USED.
4.7. POSTED: транзакции и консистентность склада + бланка + аудита (WB-501)
changeWaybillStatus выполняет сайд‑эффекты внутри транзакции:
списание топлива со склада (StockMovement EXPENSE)
перевод бланка в USED
обновление статуса ПЛ
запись AuditLog
Текущее правило склада сохранено: warehouseId = null (списание с “виртуального” склада организации).
4.8. RBAC: разделение прав на статусные операции (WB-601)
Вместо универсального waybill.approve введены раздельные permissions для смены статуса (submit/post/cancel).
Роут PATCH /waybills/:id/status проверяет право в зависимости от target‑статуса.
4.9. Политика “факт > норма” + audit (WB-701)
Добавлена проверка превышения факта над планом (например, > fuelPlanned * 1.10):
либо блокировка, либо разрешение при наличии специального права (с аудитом).
Превышения фиксируются в AuditLog.
4.10. Тесты (WB-801)
Unit: сезонность, расчёты топлива, баланс топлива, переходы/правила.
Integration: create/update/status, бланки (reserve/release/use), транзакционность POSTED, RBAC.
5) Текущий контракт API (важное)
Waybills
GET /waybills (list, с фильтрами)
POST /waybills (create)
GET /waybills/:id (getById)
PUT /waybills/:id (update)
DELETE /waybills/:id (delete)
PATCH /waybills/:id/status (смена статуса; права зависят от target‑статуса)
Vehicles
CRUD /vehicles + наличие fuelConsumptionRates в DTO.
6) Оставшиеся осознанные ограничения/решения
Статусы ПЛ — 4 (без COMPLETED). Если бизнесу нужен “закрыт, но не проведён”, потребуется миграция enum + логики.
RETURNED в BlankStatus пока не задействован. Семантика на будущее возможна (возврат водителем на склад), но сейчас не участвует в потоках.
Склад при POSTED списывается без warehouseId (null). Это зафиксировано как текущее поведение прототипа; улучшение потребует правила выбора склада (по department/настройкам).
Setting глобальный (без organizationId). Если сезонность/настройки должны быть per-org, понадобится миграция модели настроек.
7) Ключевые файлы, где теперь сосредоточена логика
backend/prisma/schema.prisma — новые поля/ограничения (fuelConsumptionRates, fuelPlanned, флаги, @unique(blankId)).
backend/src/services/waybillService.ts — канонические проверки/расчёты/CRUD/смена статуса.
backend/src/controllers/waybillController.ts — DTO‑валидация + legacy mapping.
backend/src/services/blankService.ts — операции reserve/release/use/spoil.
backend/src/services/settingsService.ts — getSeasonSettings.
backend/src/utils/dateUtils.ts — isWinterDate.
backend/src/middleware/authMiddleware.ts — req.user с organizationId/departmentId.
backend/src/middleware/checkPermission.ts + обновлённые permissions для статусов.
backend/src/routes/waybillRoutes.ts — статусы + RBAC.
8) Снимок статуса работ (как в отчёте)
Выполнены: WB-101, WB-102, BLS-101, BLS-102, BLS-104, WB-201, WB-202, WB-301, WB-302, WB-401, WB-402, WB-403, BLS-201, BLS-202, WB-501, WB-601, WB-701, WB-801
Пропущен как не требовался: BLS-103 (конфликтов blankId не найдено).