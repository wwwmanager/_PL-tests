[x] REL-101 — Локации топлива: склад / топливная карта / бак ТС
Что сделать
Backend / Prisma

Добавить StockLocation:
type: WAREHOUSE | FUEL_CARD | VEHICLE_TANK
привязки: fuelCardId?, vehicleId?, + organizationId, departmentId?
Добавить FuelCard (справочник):
cardNumber, providerName?, issuedToDriverId?, isActive
Backend / Сервисы

Сервис stockLocationService:
“получить/создать” дефолтный склад (на org или org+department)
“получить/создать” локацию бака для vehicleId
“получить/создать” локацию карты для fuelCardId
Что это решает
Топливо становится учитываемым по местам хранения, и цепочка “поставщик→склад→карта→бак→списание” выражается движениями между локациями.
REL-102 — StockMovement поддерживает TRANSFER и API “остаток на дату”
Что сделать
Backend

Расширить StockMovementType: добавить TRANSFER (если ещё нет).
Обновить POST /stock/movements DTO:
для INCOME/EXPENSE/ADJUSTMENT: stockLocationId
для TRANSFER: fromLocationId, toLocationId
везде обязательны occurredAt (+ occurredSeq опционально)
Добавить endpoints:
GET /stock/locations (фильтр по type, vehicleId, fuelCardId)
GET /stock/balances?stockItemId=...&asOf=... → остатки по локациям на дату
GET /stock/balance?locationId=...&stockItemId=...&asOf=... → остаток одной локации на дату
В stockService стандартизировать операции:
createIncome(...)
createTransfer(...)
createExpense(...)
createAdjustment(...)
Каждая операция, уменьшающая остаток, обязана вызывать проверки REL-100 и брать advisory locks.
Что это решает
API становится способным корректно отвечать “что было на 2025‑11‑20”, а не только “что сейчас”.
Все доменные проверки концентрируются в одном месте (сервис), а не расползаются по контроллерам.
REL-103 — Путевой лист: заправки как TRANSFER в бак и списание из бака по времени рейса
Что сделать
Backend / Prisma

В Waybill добавить/нормализовать времена рейса: startAt, endAt (если уже есть — привести к единообразию).
В WaybillFuel добавить refueledAt (обязательное для строк “заправка”).
Backend / Waybill POSTED

При проводке (в одной транзакции):
Для каждой заправки:
определить источник: fuelCardLocation или warehouseLocation
создать StockMovement TRANSFER в бак:
occurredAt = refueledAt
occurredSeq = порядок строки заправки (например, 100, 101…)
проверка источника “as-of” + “future non-negative”
Рассчитать fuelConsumed (ваш выбранный метод) и создать:
StockMovement EXPENSE из бака
occurredAt = waybill.endAt, occurredSeq = 1000 (после всех заправок)
Остальное как у вас сейчас: Blank USED, AuditLog, Waybill.status=POSTED
Инварианты

refueledAt должен попадать в интервал [startAt, endAt] (или ваш допустимый допуск).
Запрещены отрицательные литры; Decimal точность.
Что это решает
“Бензобак” становится реальным учётным контейнером между ПЛ, а не виртуальным расчётом.
Даты заправок/списания становятся первичными, и система сама запрещает невозможную хронологию.
REL-104 — Автопополнение топливных карт (по расписанию/правилу) как движения склада
Что сделать
Backend / Prisma

Таблица FuelCardTopUpRule:
частота (daily/weekly/monthly), режим (фикс +N или довести до target)
sourceLocationId (обычно склад)
fuelCardId, stockItemId
atTimeLocal + timezone организации (если он у вас есть/будет)
Backend / Сервис

topUpService.runTopUps({ organizationId, atUtc }):
вычисляет balanceAt(cardLocation, asOf=atUtc)
считает сколько добавить
создаёт TRANSFER warehouse → card с occurredAt=atUtc, occurredSeq=20
идемпотентность через externalRef = TOPUP:<ruleId>:<atUtcISO>
проверка склада на дату (REL-100), locks на склад+карту
API

Админские endpoints (под RBAC):
POST /admin/fuel/topups/run (параметр: дата/время, org/department scope)
GET /admin/fuel/topups/preview (что будет создано без записи)
Что это решает
Автопополнение становится частью ledger и подчиняется тем же “as-of” правилам: нельзя пополнить “после” и заправить “до”.
Есть предсказуемый аудит: почему на карте появились литры.
REL-105 — Обнуление карт (конец квартала/по требованию) как TRANSFER или EXPENSE
Что сделать
Backend / Prisma

Таблица FuelCardResetRule:
frequency: quarterly/monthly
scope: all cards / by provider / by department / list
mode:
TRANSFER_TO_WAREHOUSE (вернуть остатки в пул)
EXPIRE_EXPENSE (сгорание/списание)
targetLocationId (куда переводим при TRANSFER)
Backend / Сервис

resetService.runResets({ organizationId, resetAtUtc }):
для каждой карты в scope:
balance = balanceAt(cardLocation, resetAtUtc, seq=10)
если balance > 0 создать:
TRANSFER card → warehouse (или)
EXPENSE card (сгорание)
occurredAt=resetAtUtc, occurredSeq=10
externalRef = RESET:<ruleId>:<period>:<cardId> (уникально)
locks на карту (и склад, если transfer)
API / UI

Ручная операция “обнулить карту/группу карт на дату”:
POST /admin/fuel/resets/run + preview endpoint
Что это решает
“Закончился квартал — остатки обнулились” становится явным событием в учёте, а не невидимой правкой баланса.
Любая заправка после даты reset будет корректно запрещаться, если не было нового пополнения.
REL-106 — Смена поставщика: карты/назначения по периодам, запрет использования “не той” карты
Что сделать
Backend / Prisma

Добавить историю назначений (рекомендуется):
FuelCardAssignment(validFrom, validTo, driverId?, providerName?)
Правило выбора карты в ПЛ:
на refueledAt должна существовать активная assignment для этой карты (и карта isActive=true)
Админская операция “смена поставщика с даты”:
деактивировать старые карты/assignments с validTo=switchAt
(опционально) запустить reset остатков на switchAt
создать новые карты + assignments, запустить topup на switchAt
Frontend

В форме заправки в ПЛ показывать только карты, валидные на refueledAt.
Что это решает
“Сменился поставщик — сменились ТК” не ломает историю и не даёт заправиться “старой” картой в новом периоде.
Исторические ПЛ корректно продолжают ссылаться на карту, которая была валидна в тот момент.
REL-107 — UI: журнал топлива, балансы “на дату”, управление картами/правилами
Что сделать
Frontend

Раздел “Топливо” (вкладка склада или отдельный view):
Балансы:
выбор asOf (дата/время)
таблица локаций: склад / карты / баки, с фильтрами
Журнал движений:
фильтр по occurredAt (период), по локации, по типу
отображать createdAt отдельно (для расследований)
Топливные карты:
список карт, статус, водитель, поставщик
назначение по периодам (если REL-106)
Правила:
topup rules + reset rules (создать/выключить/preview/run)
Что это решает
Пользователь видит “остаток на дату”, а не спорит с системой из‑за задних чисел.
Админ может управлять правилами без ручных костылей “поправьте в БД”.
REL-108 — Тесты: хронология, вставка задним числом, гонки, end-to-end
Что сделать
Backend unit/integration (Vitest)

as-of расчёт:
приход в декабре, расход в ноябре → запрещено
“future non-negative”:
есть расход в декабре, затем вставляем новый расход в ноябре → запрещено, если ломает декабрь
transfer:
двойная транзакция списывает с одной карты одновременно → не уходим в минус (advisory lock)
reset/topup идемпотентность:
повторный run с тем же externalRef не создаёт дублей
E2E (Playwright)

Golden fuel path:
приход на склад (occurredAt)
автопополнение карты
ПЛ с заправкой (refueledAt) и проводка
квартальный reset и проверка запрета заправок без нового topup
Что это решает
Ловим регрессии именно там, где они самые дорогие: даты, задние числа, конкуренция.
REL-109 — Миграция и бэкфилл (чтобы не сломать текущие данные)
Что сделать
DB migration

Для существующих StockMovement:
occurredAt = createdAt (бэкфилл)
occurredSeq = 0
Создать дефолтный StockLocation(Warehouse) на организацию/подразделение
Для существующих Vehicles создать StockLocation(VEHICLE_TANK)
Для существующих “карт” (если они были неформально) — создать FuelCard + StockLocation(FUEL_CARD)
Backend

На период миграции можно разрешить occurredAt опциональным в API, но сервер должен проставлять occurredAt = now() и логировать warning. Затем сделать обязательным.
Что это решает
Вы не ломаете текущий склад и проводки, но постепенно переводите систему на корректную временную модель.

Финальная приёмка релиза топлива
1) Сквозные сценарии (smoke/regression)
Покупка в декабре → попытка заправки в ноябре

INCOME/TRANSFER на склад/карту с occurredAt=2025-12-10
попытаться создать заправку (WaybillFuel.refueledAt=2025-11-20) и POSTED
ожидаемо: запрет с понятной доменной ошибкой “недостаточно топлива на дату”.
Вставка задним числом ломает будущее

есть нормальные движения в декабре (списания/transfer-out)
пытаемся вставить расход в ноябре, который делает декабрьские операции невозможными
ожидаемо: запрет “операция задним числом делает остаток отрицательным позже”.
Reset + Top-up на одной границе периода

resetAt = 2026-01-01 00:00
topupAt = 2026-01-01 00:00
проверить, что итог соответствует вашему occurredSeq (сначала reset, потом начисление) и UI/отчёты не “флипают”.
Смена поставщика

ввести заправку “старой” картой после validTo assignment
ожидаемо: UI не показывает карту, а backend всё равно запрещает (не только фронтом).
Идемпотентность автоопераций

повторно запустить run topups/resets с теми же параметрами
ожидаемо: нет дублей (за счёт externalRef unique), результат стабилен.
2) Гонки и блокировки
Два параллельных POSTED (или две ручные заправки), которые списывают с одной и той же карты на одну и ту же дату:
ожидаемо: один проходит, второй корректно падает по “недостаточно топлива”, без ухода в минус.
Проверьте, что advisory lock ключ действительно включает (orgId, stockItemId, locationId) и для TRANSFER лочатся обе локации в детерминированном порядке.
3) Таймзоны и сравнение дат
occurredAt, refueledAt, startAt/endAt должны жить в одной модели (обычно Postgres timestamptz в UTC) и UI должен отображать в TZ организации.
Проверьте кейс “ночь/полночь” на границе квартала/месяца: reset не должен “съехать” на другой день из-за TZ.
4) Производительность “as-of” балансов
На больших организациях getBalanceAt и “future non-negative” могут стать дорогими.
Убедитесь, что индексы реально используются (EXPLAIN ANALYZE на worst-case запросы).
Особенно важны композитные индексы с (organizationId, <locationId>, stockItemId, occurredAt, occurredSeq).
5) Миграция и бэкфилл
После REL-109 проверьте:
нет StockMovement.occurredAt IS NULL
у каждой активной карты/ТС есть StockLocation
дефолтный склад существует для каждой org/department, где он ожидается
Если вы приравняли occurredAt = createdAt для старых записей: убедитесь, что это не ломает уже существующую бизнес-историю (иногда старые “документы” вводили задним числом).
Что стоит добавить в релизные заметки/документацию
Пояснение разницы createdAt vs occurredAt (и что отчёты строятся по occurredAt).
Что означает “reset” в вашей конфигурации: возврат в пул или сгорание.
Правило валидности карты по assignment history (по refueledAt).
Быстрый SQL-санити-чек (полезно перед продом)
“Есть ли движения без occurredAt”:
SQL

SELECT count(*) FROM "StockMovement" WHERE "occurredAt" IS NULL;
“Есть ли карты без локации” (если у вас связь через StockLocation.fuelCardId):
SQL

SELECT c.id
FROM "FuelCard" c
LEFT JOIN "StockLocation" l ON l."fuelCardId" = c.id
WHERE l.id IS NULL;
“Есть ли отрицательные остатки на сейчас” (если у вас есть API/вьюха — лучше ей; иначе агрегатом по движениям):
в зависимости от вашей реализации, но смысл — найти локации, где сумма дельт < 0.
Если всё это зелёное, то релиз действительно можно считать закрытым. Если где-то всплывут “странные” падения, почти всегда это одно из трёх: TZ на границе периода, неполная индексация под as-of, или забытая блокировка/проверка “future non-negative” в каком-то одном пути (обычно в ручных движениях, не в POSTED).