 Каждый тикет: Task / Files / Steps / Expected result / Tests.

WB-101 — Prisma: добавить нормы расхода в Vehicle [x]
Task
Добавить хранение норм расхода топлива на уровне ТС в БД: Vehicle.fuelConsumptionRates (Json?).

Files

backend/prisma/schema.prisma
миграция Prisma (создастся в backend/prisma/migrations/...)
Steps

В Vehicle добавить поле fuelConsumptionRates Json?.
Выполнить prisma migrate (safe migration).
Обновить Prisma Client.
Expected result

В таблице vehicles появляется колонка fuelConsumptionRates (nullable JSON).
Prisma Client генерируется без ошибок.
Tests

Smoke: поднять backend, выполнить GET /vehicles (пока без изменения контроллера поле может не возвращаться — это ок на этом тикете).
Проверка через psql/DB GUI: колонка существует.
WB-102 — Prisma: добавить поля для планового расхода и флагов маршрута [x]
Task
Добавить в БД:

Waybill.isCityDriving, Waybill.isWarming
WaybillFuel.fuelPlanned
Files

backend/prisma/schema.prisma
миграция Prisma
Steps

В Waybill добавить:
isCityDriving Boolean @default(false)
isWarming Boolean @default(false)
В WaybillFuel добавить:
fuelPlanned Decimal? @db.Decimal(10, 2)
Применить миграцию.
Expected result

Поля доступны в Prisma Client.
Старые записи валидны (дефолты false).
Tests

Smoke: prisma.waybill.findMany({ take: 1 }) не падает.
Создать тестовый WaybillFuel и убедиться, что fuelPlanned сохраняется.
BLS-101 — Prisma: индекс для быстрого выбора “следующего бланка” [x]
Task
Добавить индекс на Blank для операции “взять следующий ISSUED бланк водителя по номеру”.

Files

backend/prisma/schema.prisma
миграция Prisma
Steps

В model Blank добавить:
@@index([organizationId, issuedToDriverId, status, series, number])
Применить миграцию.
Expected result

В БД создан индекс, запросы выбора следующего бланка ускоряются.
Tests

Smoke: миграция применена, схема валидна.
BLS-102 — Data audit: найти дубли blankId в waybills [x]
Task
Проверить, есть ли исторические данные, где один blankId привязан к нескольким Waybill (нужно перед введением уникального ограничения).

Files

Новый скрипт: backend/scripts/auditWaybillBlankDuplicates.ts (или аналогичный путь)
Документация/лог вывода (stdout)
Steps

Написать скрипт Prisma, который группирует Waybill по blankId (где blankId != null) и ищет группы count > 1.
Для каждой группы вывести:
blankId
список waybill.id + status + date + number
Скрипт должен завершаться с кодом 0, но печатать предупреждения.
Expected result

Есть прозрачный отчёт по конфликтам перед миграцией @unique.
Tests

Запуск скрипта на dev БД не падает.
Если дубликатов нет — пишет “0 conflicts”.
BLS-103 — Data fix: разрулить дубли blankId (safe) [skipped: no conflicts]
Task
Автоматически починить дубли (если есть), чтобы можно было добавить @unique(blankId).

Files

backend/scripts/fixWaybillBlankDuplicates.ts
(опционально) запись в AuditLog (если решите логировать этим же скриптом)
Steps

Для каждого blankId с дублем выбрать “правильный” Waybill по правилу:
приоритет POSTED (если есть),
иначе самый новый по updatedAt/createdAt.
Во всех остальных Waybill этой группы:
поставить blankId = null
(Опционально, но полезно) создать AuditLog записи “DATA_FIX”/“UPDATE” с деталями (если не хотите расширять enum — хотя бы лог в stdout).
Expected result

После выполнения скрипта в БД нет ситуаций “один blankId в нескольких waybills”.
Tests

Прогнать BLS-102 после фикса — конфликтов 0.
Сервис waybill работает, выборка по waybills не падает.
BLS-104 — Prisma: запретить один и тот же blankId в нескольких ПЛ [x]
Task
Добавить уникальность Waybill.blankId на уровне БД.

Files

backend/prisma/schema.prisma
миграция Prisma
Steps

В model Waybill пометить:
blankId String? @unique @db.Uuid
Применить миграцию.
Expected result

БД гарантирует: один бланк не может быть привязан к двум путевым листам (при blankId != null).
Tests

Негативный тест: попытка создать второй Waybill с тем же blankId падает с ошибкой уникальности.
WB-201 — Backend: расширить Vehicle API, чтобы отдавать/принимать fuelConsumptionRates [x]
Task
Сделать так, чтобы реальные API возвращали/сохраняли fuelConsumptionRates, и фронт перестал зависеть от mock.

Files

backend/src/routes/vehicleRoutes.ts (или где routes по авто)
backend/src/controllers/vehicleController.ts
backend/src/services/vehicleService.ts (если есть)
(опционально) backend/src/types/... DTO
Steps

В list/get endpoints добавить поле fuelConsumptionRates в select/include.
В create/update endpoints разрешить принимать fuelConsumptionRates и сохранять в БД.
Валидация: если поле пришло, проверить структуру (числа, >=0).
Expected result

GET /vehicles и GET /vehicles/:id возвращают fuelConsumptionRates.
POST/PUT /vehicles сохраняют нормы.
Tests

Integration: создать авто с rates → получить его обратно и сравнить rates.
Негатив: rates с строками/NaN → 400.
WB-202 — Frontend: обновить vehicleApi.ts под fuelConsumptionRates [x]
Task
Добавить fuelConsumptionRates в VehicleDto и инпуты создания/обновления.

Files

vehicleApi.ts
Steps

Расширить VehicleDto (optional/nullable).
Расширить CreateVehicleInput/UpdateVehicleInput (optional).
Убедиться, что сборка/типизация не ломается.
Expected result

Типы на фронте соответствуют backend.
selectedVehicle.fuelConsumptionRates приходит из API.
Tests

Typecheck/build фронта.
Smoke: UI открывает карточку авто без падений, даже если fuelConsumptionRates = null.
WB-301 — Backend utils: реализовать isWinterDate под текущий SeasonSettings [x]
Task
Реализовать “зиму” на бэкенде с поддержкой SeasonSettings из settingsService.ts.

Files

backend/src/utils/dateUtils.ts (новый)
backend/src/services/settingsService.ts (использование останется, но добавить импорт/тип при необходимости)
Steps

Реализовать isWinterDate(dateISO, seasonSettings):
recurring: зима от winterDay/winterMonth до summerDay/summerMonth (интервал может пересекать НГ).
manual: winterStartDate/winterEndDate, интервал может пересекать НГ.
Добавить защиту от невалидных дат.
Expected result

Бэкенд может определять зимний период так же, как фронт ожидает по смыслу.
Tests

Unit: recurring (пример: winter 01.11 → summer 01.04), проверить январь=true, май=false.
Unit: manual “через НГ”, проверить ноябрь/февраль=true, октябрь=false.
WB-302 — Backend domain: расчёт planned расхода и валидация топливного баланса [x]
Task
Сделать доменный модуль расчёта топлива на бэкенде (planned) + проверку математики топлива.

Files

backend/src/domain/waybill/fuel.ts (новый)
Steps

Реализовать:
calculateDistanceKm(odStart, odEnd) (Decimal/number аккуратно)
calculatePlannedFuel(distanceKm, rates, flags, isWinter)
calculateFuelEnd(start, received, consumed)
validateFuelBalance(...) с допуском (например ±0.05)
Согласовать округления до 2 знаков (как сейчас на фронте).
Expected result

Есть чистые функции, которые можно тестировать и переиспользовать в waybillService.
Tests

Unit: planned для winter/summer + city/warming.
Unit: validateFuelBalance проходит на корректных данных и падает на некорректных.
WB-401 — WaybillController: DTO-валидация + legacy mapping топлива [x]
Task
Перестать принимать req.body as any; валидировать и нормализовать payload, сохраняя совместимость с текущим фронтом.

Files

backend/src/controllers/waybillController.ts
(если добавите библиотеку) backend/package.json (zod/joi)
Steps

Добавить схему валидации для create/update:
date/ids/odometer/flags
fuelLines[] (валидировать числа >=0)
legacy поля fuelAtStart/fuelFilled/fuelAtEnd/fuelPlanned (optional)
Если legacy поля присутствуют:
смэппить их в fuelLines[0] (или дополнить первую строку)
В контроллер передавать в сервис только нормализованный объект.
Expected result

Некорректные payload → 400 с понятным сообщением.
Текущий фронт продолжает работать без изменения payload.
Tests

Integration: POST с legacy payload проходит и создаёт fuelLine.
Integration: POST с отрицательным fuelConsumed → 400.
WB-402 — WaybillService: createWaybill — валидация одометра/топлива + расчёт fuelPlanned [x]
Task
Сделать backend каноническим источником planned расхода и целостности данных при создании ПЛ.

Files

backend/src/services/waybillService.ts
backend/src/services/settingsService.ts (использовать getSeasonSettings)
backend/src/utils/dateUtils.ts, backend/src/domain/waybill/fuel.ts (из предыдущих задач)
Steps

Перед созданием:
валидировать дату
одометр: если оба заданы → end >= start, иначе ошибка
Для каждой строки топлива:
валидировать числа
если есть start/received/consumed/end → проверить баланс
Рассчитать fuelPlanned:
загрузить vehicle.fuelConsumptionRates
получить season_settings
определить isWinterDate
применить isCityDriving/isWarming из input
Сохранить computed fuelPlanned в WaybillFuel (перезаписывая присланное, если есть).
Expected result

Новые ПЛ создаются с корректной математикой.
WaybillFuel.fuelPlanned появляется и соответствует нормам авто.
Tests

Integration: создать авто с rates, создать ПЛ с odometer 1000→1050, flags city/warming → planned заполнен.
Integration: odometerEnd < odometerStart → 400.
WB-403 — WaybillService: updateWaybill — replace fuelLines + запрет правок POSTED [x]
Task
Доработать update: обновлять fuelLines, пересчитывать planned, запретить изменения для POSTED.

Files

backend/src/services/waybillService.ts
Steps

При updateWaybill загрузить текущий waybill.
Если status === POSTED:
запретить изменения odometer/fuelLines/blankId/status-sensitive полей (400/403 по вашей политике).
Если data.fuelLines пришли:
в транзакции deleteMany({ waybillId }) + createMany (или create массива)
Пересчитать planned для обновлённых данных (если есть rates).
Сохранить обновления.
Expected result

Update реально обновляет топливные строки.
POSTED защищён от “переписывания истории”.
Tests

Integration: обновить fuelLines → старые удалены, новые созданы.
Integration: попытка обновить POSTED → ошибка.
BLS-201 — BlankService: реализовать reserveNext/reserveSpecific/release/use/spoil атомарно [x]
Task
Добавить в бэкенд бизнес-операции жизненного цикла бланка с защитой от гонок.

Files

backend/src/services/blankService.ts
Steps

Реализовать методы:
reserveNextBlankForDriver(orgId, driverId, departmentId?)
reserveSpecificBlank(orgId, blankId, driverId, departmentId?)
releaseBlank(orgId, blankId)
useBlank(orgId, blankId)
spoilBlank(orgId, blankId, reason)
reserveNextBlankForDriver сделать атомарным:
транзакция
SQL с блокировкой строк (под Postgres), чтобы две параллельные операции не взяли один и тот же номер
Везде проверять organizationId и (где применимо) departmentId и issuedToDriverId.
Expected result

Резервирование работает корректно при параллельных запросах.
Переходы статусов соответствуют вашей схеме: ISSUED↔RESERVED→USED, …→SPOILED.
Tests

Unit/Integration: параллельно вызвать reserveNext 2 раза → получить 2 разных бланка.
Негатив: reserveSpecific для чужого водителя → 400/403.
BLS-202 — Интеграция: резервирование/освобождение бланка при create/update/delete Waybill [x]
Task
Сделать так, чтобы бланк не “зависал” в RESERVED и не использовался дважды: интегрировать lifecycle в операции ПЛ.

Files

backend/src/services/waybillService.ts
backend/src/services/blankService.ts
Steps

createWaybill:
если blankId указан → reserveSpecificBlank (ISSUED→RESERVED) + привязка к waybill
если не указан → reserveNextBlankForDriver + привязка
updateWaybill:
если меняется driverId/vehicleId/blankId и был RESERVED бланк → releaseBlank + затем резервировать новый
deleteWaybill:
если привязан бланк и он RESERVED → release перед удалением
Все операции — в транзакции.
Expected result

RESERVED используется только “живыми” черновиками.
Отмена/удаление черновика возвращает бланк в ISSUED.
Tests

Integration: создать waybill без blankId → бэк сам резервирует; blank становится RESERVED.
Integration: удалить DRAFT → blank возвращается в ISSUED.
WB-501 — changeWaybillStatus: транзакция + корректный перевод бланка и складских движений [x]
Task
Сделать проведение (POSTED) атомарным: склад + бланк + статус + audit.

Files

backend/src/services/waybillService.ts
backend/src/services/stockService.ts (если нужно прокинуть tx или убрать отдельный PrismaClient)
backend/src/utils/errors.ts (если добавите новые ошибки/коды)
Steps

Обернуть changeWaybillStatus в prisma.$transaction.
Внутри tx:
проверить allowed transition
если POSTED:
создать EXPENSE movements по fuelLines (warehouseId остаётся null как “общий”)
useBlank (RESERVED/ISSUED→USED)
обновить waybill.status + approvedBy/completedBy (как у вас сейчас)
создать auditLog
Убедиться, что createExpenseMovement не создаёт свои транзакции отдельно (лучше использовать tx.stockMovement.create напрямую или передавать tx).
Expected result

Нельзя получить частичное состояние (например, списания без POSTED).
При ошибке на любом шаге — откат всего.
Tests

Integration: смоделировать ошибку на шаге обновления blank (например, blank отсутствует) → убедиться, что StockMovement не создан.
Integration: нормальный POSTED → movements + USED + audit есть.
WB-601 — RBAC: разделить права на смену статусов (submit/post/cancel) [x]
Task
Убрать “всемогущее” waybill.approve и разделить права по операциям статуса.

Files

backend/src/routes/waybillRoutes.ts
новый middleware: backend/src/middleware/checkWaybillStatusPermission.ts (или аналог)
сиды/инициализация permissions: файл/скрипт, где создаются Permission и привязываются к ролям (если нет — создать backend/scripts/seedPermissions.ts)
(опционально) документация RBAC
Steps

Добавить permission codes:
waybill.submit
waybill.post
waybill.cancel
(опционально) waybill.overrideNorm
В PATCH /:id/status:
заменить checkPermission('waybill.approve') на middleware, который:
читает req.body.status
применяет нужный checkPermission(...)
Обновить RolePermission для ролей (admin/dispatcher и т.д.).
Expected result

Без waybill.post нельзя сделать POSTED.
Без waybill.cancel нельзя отменить.
Tests

Integration: роль без waybill.post получает 403 на POSTED.
Integration: роль с waybill.submit может DRAFT→SUBMITTED.
WB-701 — Политика “факт > норма”: soft/hard validation + audit [x]
Task
Добавить правило контроля превышения факта над planned (например, +10%) с управлением через permission.

Files

backend/src/services/waybillService.ts
backend/src/middleware/checkPermission.ts (использование уже есть)
backend/src/services/auditService.ts (если есть) или текущая auditLog вставка
Steps

В create/update:
если computed fuelPlanned != null и fuelConsumed != null:
если fuelConsumed > fuelPlanned * 1.10:
если нет права waybill.overrideNorm → 400/403
если есть → разрешить, но записать AuditLog “превышение нормы”
Явно задокументировать допустимую погрешность.
Expected result

Превышение нормы контролируется и трассируется через audit.
Tests

Integration: без права override → ошибка при превышении.
Integration: с правом override → success + auditLog запись.
WB-801 — Тестовый набор: unit + integration для расчётов, бланков, статусов [x]
Task
Добавить минимальные тесты, чтобы зафиксировать новую доменную логику.

Files

backend/src/utils/dateUtils.test.ts
backend/src/domain/waybill/fuel.test.ts
backend/src/services/blankService.int.test.ts
backend/src/services/waybillService.int.test.ts или backend/src/routes/waybillRoutes.int.test.ts
тестовая инфраструктура (jest/vitest/supertest) — где у вас принято
Steps

Подключить тестовый раннер (если отсутствует).
Unit tests:
isWinterDate (recurring/manual, через НГ)
calculatePlannedFuel (winter/summer + city/warming)
validateFuelBalance
Integration tests:
legacy payload POST /waybills
reserveNext concurrency (2 параллельных вызова)
POSTED транзакционность (ошибка → откат)
RBAC на PATCH status
Expected result

Автотесты стабильно подтверждают новые гарантии.
Tests

Это и есть тестовый тикет: прогон в CI/локально зелёный.
