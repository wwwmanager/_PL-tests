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

Контекст‑пак текущего окна (waybill-app)
0) Зачем это
Зафиксировать единый контекст по текущему состоянию приложения, сделанным доработкам и проблемам “починили одно — сломали другое”, чтобы дальше двигаться по стабильной стратегии (контекст → инварианты → автопроверки), а не по симптомам.

1) Архитектура и базовые компоненты
Frontend: React 19 + Vite + Tailwind, SPA.
Backend: Node.js + Express + TypeScript + Prisma.
DB: PostgreSQL.
Auth: JWT; authMiddleware кладёт в req.user: { id, organizationId, departmentId, role }.
RBAC: RolePermission + middleware checkPermission с кешем на 1 минуту.
Multi-tenant: фактически “multi-org”: изоляция по organizationId (+ местами departmentId).
2) Домен: Путевые листы (Waybill)
Статусы Waybill (фактически в Prisma/БД)
DRAFT, SUBMITTED, POSTED, CANCELLED.

Топливо/плановый расход (fuelPlanned)
Ранее: расчёты жили на фронте, бэкенд “верил” входным данным.
Сейчас: внедрена новая система расчёта fuelPlanned на backend с 3 методами:
Boiler (котловой, базовый) — должен быть default.
Segments (по отрезкам, точный) — суммирование по сегментам маршрута.
Mixed (по общему, смешанный) — средняя норма по сегментам применяется к одометру.
fuelPlanned пересчитывается автоматически на create/update; есть метод‑специфичные валидации.
Маршрутные сегменты
На фронте добавлены тумблеры City/Warming на сегментах маршрута.
API расширено для структурированных данных маршрута.
3) Домен: Бланки БСО (путевые листы)
Жизненный цикл (целевая модель)
AVAILABLE → ISSUED → RESERVED → USED, плюс:

RESERVED → ISSUED (release при отмене/удалении черновика)
AVAILABLE|ISSUED|RESERVED → SPOILED
RETURNED присутствует как статус “на будущее” (не используется активно).
Критические гарантии
Выдача диапазона — атомарная и защищена от гонок.
Резерв/освобождение/использование бланка встроены в CRUD ПЛ.
Waybill.blankId уникален (один бланк не может быть в двух ПЛ).
4) Справочник “Транспорт”: что было и что сделано
Проблема: не сохранялись/не отображались поля (год, тип ТС, водитель, тип топлива, пробег, остаток).

Сделано пользователем:

Расширена схема Vehicle: добавлены недостающие поля (год, тип ТС, водитель, тип топлива) + админские данные (ПТС/ОСАГО/диагностические карты).
Обновлён vehicleService: сохраняет все проблемные поля, включая mileage и currentFuel.
Миграции применены, данные синхронизированы.
5) Главная боль последнего этапа
Система “разваливается” не только из‑за багов, а из‑за неуправляемого контекста данных:

5.1. Пустые справочники (Сотрудники/Транспорт) в журналах
Причина в конкретных кейсах: organizationId в токене указывает на старую организацию (например “Оптима/Оптима‑3”), а данные перенесены в другую (“Минсельхоз”). Поэтому API корректно возвращает пусто для “не той” организации.

5.2. “Выданные бланки водителя не видны”
Причина: путаница Employee vs Driver и дубликаты по ФИО:

несколько сотрудников “Иванов Иван …”
бланки привязаны к Driver одного Employee, а UI смотрит другого Employee без записи Driver → сводка пустая.
5.3. Регрессии уровня DTO/контрактов
Пример: number был обязателен в Zod, хотя номер должен присваиваться автоматически из бланка. Это уже исправлялось (number стал optional), но класс проблемы остался: контракт “живёт в нескольких местах”.

6) Что агент и команда уже делали для устойчивости справочников
Исправлялась проверка admin роли в checkPermission.ts (case-insensitive).
Обсуждалась/внедрялась безопасная фильтрация по departmentId (применять фильтр только если задан, иначе не ограничивать).
Важно: даже если это исправлено, основной источник “пусто” всё равно может быть неправильная организация в токене — то есть проблема не в query, а в контексте.

7) Новая стратегия внесения исправлений
Чтобы прекратить “ветряные мельницы”, принято направление:

Сделать контекст явным (в UI и API): кто я, какая организация/департамент, какая роль, какой driver/employee.
Зафиксировать доменные инварианты (Driver всегда существует для driver‑employee; везде driverId=Driver.id).
Добавить “страховочную сетку”: e2e golden-path тест, который ловит поломку системы целиком.
8) Согласованный backlog “стабилизации” (REL‑серия)
Сформированы тикеты (Jira-style) для стабилизации:

REL-001 Backend GET /me (контекст: user/org/dept/role + опционально employee/driver).
REL-002 Frontend ContextBar в шапке + “Скопировать диагностику”.
REL-003 Frontend: разные пустые состояния (403 vs 500 vs 200 пусто).
REL-010 Стандартизация “водитель = Driver.id” (искоренить employeeId как driverId).
REL-011 Инвариант: если employeeType=driver, запись Driver должна существовать (автосоздание).
REL-012 Frontend: селекторы “водитель” должны работать по Drivers, а не по Employees.
REL-020 requestId + структурированные логи.
REL-030 e2e smoke “golden path”.
REL-031 стабильный seed демо‑данных без ловушек контекста.
REL-040 инвалидировать RBAC cache безопасно.
Также подготовлены шаблоны кода:

middleware requestId
backend controller /me
frontend MeProvider + ContextBar
e2e goldenPath.test.ts (через Prisma + сервисы).
9) Текущие ключевые “правила истины” проекта
Любые списки/справочники должны быть явно привязаны к organizationId из токена.
Пустой список ≠ баг: нужно различать “нет данных в организации” vs “нет прав” vs “ошибка”.
Везде, где речь о водителе и бланках/ПЛ — Driver.id, не Employee.id.
Номер ПЛ должен присваиваться автоматически из бланка (а DTO/валидации это не должны ломать).
10) Что считать “готовым” после внедрения REL‑серии
Пользователь всегда видит в шапке: организация/подразделение/роль.
Любой “пустой справочник” объясняется UI: почему пусто.
Нельзя выбрать “не того Иванова” незаметно: либо нет Driver и UI это показывает, либо выбираем Driver напрямую.
Golden-path тест зелёный: бланки → выдача → создание ПЛ → POSTED → склад + USED + audit.
