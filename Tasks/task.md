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

План на завтра: 

WH-001 — Добавить раздел “Склад” и каркас страницы
Что сделать
Frontend

В App.tsx (или где у вас роутинг по View) добавить пункт меню WAREHOUSE.
Создать components/warehouse/Warehouse.tsx:
Внутренние вкладки:
Остатки топлива
Журнал движений
(позже) “Топливные карты / Правила”
Добавить RBAC-гейт:
если нет прав на склад — показывать EmptyState forbidden.
если прав нет частично: можно показывать “Журнал” без кнопки “Создать движение”.
Критерии приёмки
В меню появился “Склад”.
Переход открывает страницу с 2 вкладками (Остатки/Журнал).
Без прав не видно данных и/или кнопок действий.
WH-002 — API-клиент для склада и типы
Что сделать
Frontend

Создать services/api/stockApi.ts:
getStockItems() → /stock/items
[x] getStockMovements(params) → /stock/movements (fixed V2 alignment)
[x] createStockMovement(payload) → POST /stock/movements/v2 (fixed alignment)
[ ] getStockBalances(params) → если у вас уже есть endpoint балансов; если нет — временно скрыть вкладку “Остатки” (или показывать “пока не реализовано”).
Типы:
StockMovementType, StockLocationType, StockMovement, StockBalanceRow
Нормализация:
occurredAt всегда отправляем/получаем как ISO string, в UI форматируем.
Критерии приёмки
Все запросы уходят через единый httpClient.
Ошибки проходят через ваш общий механизм EmptyState.
WH-003 — Вкладка “Журнал движений топлива” (основной экран)
Что сделать
Frontend UI

Компонент: components/warehouse/FuelMovements.tsx
Вверху фильтры:
Период: from / to по occurredAt (не createdAt)
Тип: INCOME / EXPENSE / TRANSFER / ADJUSTMENT
Локация: “Склад”, “Карта”, “Бак ТС” + конкретная (если есть /stock/locations)
Топливо (stockItem): ДТ/АИ-92/… (из /stock/items)
Поиск: по externalRef / comment / waybillNumber (если есть)
Таблица (минимум колонки):
occurredAt
type
from → to (или location для income/expense/adjust)
quantity
stockItem
externalRef
relatedWaybillId (ссылка на ПЛ, если есть)
createdAt (вторично, мелким текстом или в раскрытии строки)
Пагинация:
page/pageSize, сортировка по occurredAt desc по умолчанию
UX правила

Явно подписать: “Период по дате факта (occurredAt)”.
Для TRANSFER всегда показывать обе стороны (откуда/куда).
Для записей из ПЛ показывать бейдж “ПЛ” и ссылку.
Критерии приёмки
Можно отфильтровать движения за период и увидеть корректный порядок по occurredAt.
Запись с relatedWaybillId кликабельна и ведёт на карточку ПЛ.
Ошибки 403/500 отображаются корректно.
WH-004 — Кнопка “Создать движение” + модал создания
Что сделать
Frontend

Компонент: components/warehouse/MovementCreateModal.tsx
Открывается с вкладки “Журнал движений”.
Поля формы (React Hook Form + Zod):
occurredAt (datetime)
movementType (select)
stockItemId (select)
quantity (decimal, > 0 для income/expense/transfer; для adjustment можно разрешить +/-)
Локации:
INCOME/EXPENSE/ADJUSTMENT: stockLocationId
TRANSFER: fromLocationId + toLocationId
externalRef (опционально, но желательно для INCOME)
comment (обязателен для ADJUSTMENT)
Валидации:
toLocationId !== fromLocationId
occurredAt обязателен
quantity > 0 (кроме adjustment)
После успеха:
закрыть модал
обновить таблицу
показать toast “Движение создано”
RBAC

Кнопку “Создать движение” показывать только при наличии права (например stock.movement.create).
Критерии приёмки
Можно создать INCOME (поставщик→склад), TRANSFER (склад→карта) и ADJUSTMENT.
Серверные доменные ошибки (400/409 “недостаточно топлива на дату”) отображаются текстом без “Unknown error”.
WH-005 — “Остатки топлива на дату” (вкладка балансов)
Что сделать
Frontend UI

Компонент: components/warehouse/FuelBalances.tsx
Вверху:
asOf (datetime)
stockItemId (фильтр)
(опционально) фильтр по типу локации: склад/карты/баки
Таблица:
Локация (тип + имя)
Привязка (для карты: номер/водитель; для бака: госномер)
Кол-во
Группировка секциями:
WAREHOUSE / FUEL_CARD / VEHICLE_TANK
Если backend балансов ещё нет

Не блокировать релиз:
вкладку “Остатки” показывать, но с EmptyState “Баланс API не подключён” и ссылкой “смотрите Журнал”.
либо временно убрать вкладку.
Критерии приёмки
При смене asOf данные пересчитываются и явно меняются по истории.
Балансы показываются именно “на дату”, не “на сейчас”.
WH-006 — Локации: селекты “Склад / Карта / Бак” (если нет отдельного справочника локаций)
Что сделать
Если у вас ещё нет /stock/locations, но движения требуют выбирать локацию, можно сделать минимально:

Вариант A (правильный): добавить GET /stock/locations на backend и использовать его в UI.

Вариант B (временный): хардкодить:

“Склад организации” как единственный locationId (получать из /me + отдельный endpoint “default warehouse location”)
“Бак ТС” выбирать через /vehicles (и на backend маппить vehicleId → tankLocationId)
“Карту” выбирать через /fuel-cards (маппить fuelCardId → cardLocationId)
Для UI лучше A: селект “Локация” должен быть единым списком.

Критерии приёмки
В модале создания движения пользователь реально может выбрать нужную “точку” (склад/карта/бак) без костылей.
WH-007 — Пустые состояния и диагностика “почему пусто”
Что сделать
Frontend

Для журнала и остатков различать:
403: “Нет прав на склад”
200 + пусто: “Движений нет за выбранный период”
200 + пусто из-за фильтра: “Сбросьте фильтры”
Кнопка “Сбросить фильтры”
В журнале показывать активные фильтры чипами (удаляемыми)
Критерии приёмки
Пользователь понимает, пусто потому что “нет данных” или потому что “фильтры”.
WH-008 — Минимальные E2E сценарии для склада
Что сделать (Playwright)
[x] Исправить ошибки типов в бэкенде (stockController.ts, stockLocationController.ts)
[x] Запустить бэкенд и убедиться, что стартует на 3001
[x] Тест "INCOME": Проверить прохождение создания прихода
[x] Тест "TRANSFER": Разобраться с маппингом полей и падением теста
[ ] Финальный прогон warehouse-management.e2e.spec.ts

[x] Открыть “Склад → Журнал”, создать INCOME на склад (occurredAt вчера) → запись появилась. (Attempted, currently debugging Backend alignment)
[x] Создать TRANSFER склад→карта (occurredAt сегодня) → запись появилась, from/to отображаются.
[ ] Попытаться сделать TRANSFER “раньше прихода” → увидеть доменную ошибку “недостаточно топлива на дату”.
Критерии приёмки
Базовый функционал склада живой и защищает хронологию.
Файловая структура (как бы я разложил)
text

components/warehouse/
  Warehouse.tsx
  FuelMovements.tsx
  FuelBalances.tsx
  MovementCreateModal.tsx
  LocationSelect.tsx
services/api/
  stockApi.ts
hooks/
  useStockItems.ts
  useStockMovements.ts
  useStockBalances.ts

Ниже — готовые “заготовки”, которые можно прямо класть в код:

формат query-параметров для /stock/movements
services/api/stockApi.ts
Zod-схема + преобразование payload для модала “Создать движение”
конкретные колонки таблицы “Журнал движений топлива” + рендер “откуда → куда” и ссылки на ПЛ
1) Формат query для GET /stock/movements
Рекомендованный формат (читаемый и расширяемый):

occurredFrom: ISO datetime
occurredTo: ISO datetime
movementType: INCOME|EXPENSE|ADJUSTMENT|TRANSFER
stockItemId: string
locationId: string (универсальный фильтр: ищем движения где location участвует как stockLocationId или fromLocationId или toLocationId)
q: строка поиска по externalRef/comment (если бэк поддерживает)
page: number (1-based)
pageSize: number (например 25/50/100)
orderBy: строка, например occurredAt:desc (опционально)
Пример:

text

/stock/movements?occurredFrom=2025-12-01T00:00:00.000Z&occurredTo=2025-12-31T23:59:59.999Z&movementType=TRANSFER&locationId=loc_123&page=1&pageSize=50
2) services/api/stockApi.ts
TypeScript

// services/api/stockApi.ts
import httpClient from '../httpClient';

export type StockMovementType = 'INCOME' | 'EXPENSE' | 'ADJUSTMENT' | 'TRANSFER';
export type StockLocationType = 'WAREHOUSE' | 'FUEL_CARD' | 'VEHICLE_TANK';

export type StockItem = {
  id: string;
  name: string;
  unit?: string | null; // 'л'
};

export type StockLocation = {
  id: string;
  type: StockLocationType;
  name: string;

  vehicleId?: string | null;
  fuelCardId?: string | null;

  // Полезно для UI (если бэк отдаёт)
  vehicleRegistrationNumber?: string | null;
  fuelCardNumber?: string | null;
  driverName?: string | null;
};

export type StockMovement = {
  id: string;
  organizationId: string;

  movementType: StockMovementType;
  stockItemId: string;
  quantity: string; // Decimal как string

  stockLocationId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;

  occurredAt: string; // ISO
  occurredSeq?: number;

  externalRef?: string | null;
  comment?: string | null;

  relatedWaybillId?: string | null;

  createdAt: string; // ISO

  // Если бэк отдаёт денормализованные имена — супер, UI проще
  stockItemName?: string;
  stockLocationName?: string | null;
  fromLocationName?: string | null;
  toLocationName?: string | null;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type GetStockMovementsQuery = {
  occurredFrom?: string; // ISO
  occurredTo?: string;   // ISO
  movementType?: StockMovementType;
  stockItemId?: string;
  locationId?: string;
  q?: string;

  page?: number;
  pageSize?: number;
  orderBy?: string; // e.g. "occurredAt:desc"
};

function toSearchParams(q: Record<string, unknown>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (!s) continue;
    sp.set(k, s);
  }
  return sp;
}

// ВАЖНО: у вас на бэке может быть либо массив, либо пагинированный ответ.
// Этот адаптер поддерживает оба варианта без падений.
function coercePaginated<T>(data: any, fallbackPage = 1, fallbackPageSize = 50): Paginated<T> {
  if (data && Array.isArray(data.items) && typeof data.total === 'number') return data;
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: fallbackPage, pageSize: fallbackPageSize };
  }
  return { items: [], total: 0, page: fallbackPage, pageSize: fallbackPageSize };
}

export async function getStockItems(): Promise<StockItem[]> {
  return httpClient.get<StockItem[]>('/stock/items');
}

// Если эндпоинта пока нет — можно временно не использовать.
// (Но для нормального селекта локаций лучше добавить /stock/locations)
export async function getStockLocations(params?: {
  type?: StockLocationType;
}): Promise<StockLocation[]> {
  const sp = toSearchParams(params ?? {});
  const qs = sp.toString();
  return httpClient.get<StockLocation[]>(`/stock/locations${qs ? `?${qs}` : ''}`);
}

export async function getStockMovements(
  query: GetStockMovementsQuery
): Promise<Paginated<StockMovement>> {
  const sp = toSearchParams({
    ...query,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 50,
    orderBy: query.orderBy ?? 'occurredAt:desc',
  });
  const data = await httpClient.get<any>(`/stock/movements?${sp.toString()}`);
  return coercePaginated<StockMovement>(data, query.page ?? 1, query.pageSize ?? 50);
}

export type CreateStockMovementPayload =
  | {
      occurredAt: string; // ISO
      occurredSeq?: number;
      movementType: 'INCOME' | 'EXPENSE';
      stockItemId: string;
      quantity: string; // Decimal string
      stockLocationId: string;

      externalRef?: string | null;
      comment?: string | null;
    }
  | {
      occurredAt: string;
      occurredSeq?: number;
      movementType: 'ADJUSTMENT';
      stockItemId: string;
      quantity: string; // Decimal string, может быть отрицательным
      stockLocationId: string;

      externalRef?: string | null;
      comment: string; // обязателен
    }
  | {
      occurredAt: string;
      occurredSeq?: number;
      movementType: 'TRANSFER';
      stockItemId: string;
      quantity: string;
      fromLocationId: string;
      toLocationId: string;

      externalRef?: string | null;
      comment?: string | null;
    };

export async function createStockMovement(
  payload: CreateStockMovementPayload
): Promise<StockMovement> {
  return httpClient.post<StockMovement>('/stock/movements', payload);
}

// Если баланс-эндпоинта ещё нет — не вызывайте, а вкладку “Остатки” показывайте как placeholder.
export type StockBalanceRow = {
  locationId: string;
  locationType: StockLocationType;
  locationName: string;
  stockItemId: string;
  quantity: string; // Decimal string
};

export async function getStockBalances(params: {
  asOf: string; // ISO
  stockItemId?: string;
  locationType?: StockLocationType;
}): Promise<StockBalanceRow[]> {
  const sp = toSearchParams(params);
  return httpClient.get<StockBalanceRow[]>(`/stock/balances?${sp.toString()}`);
}
3) Zod-схема для модала “Создать движение” + сборка payload
Ключевые моменты:

occurredAt берём из <input type="datetime-local"> → это локальное время. Его надо переводить в ISO (UTC).
quantity держим строкой, чтобы не ловить float-ошибки.
Условия по полям зависят от movementType.
TypeScript

// components/warehouse/movementSchemas.ts
import { z } from 'zod';
import type { CreateStockMovementPayload, StockMovementType } from '../../services/api/stockApi';

const DECIMAL_3 = /^-?\d+(\.\d{1,3})?$/;

const trimToNull = (v: unknown) => {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  return t === '' ? null : t;
};

// datetime-local ("2025-12-20T09:30") -> ISO string (UTC)
export function dateTimeLocalToIso(value: string): string {
  // JS Date(string-without-timezone) трактует как local time.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid datetime');
  return d.toISOString();
}

export const movementFormSchema = z
  .object({
    occurredAtLocal: z.string().min(1, 'Укажите дату/время операции'), // datetime-local
    movementType: z.enum(['INCOME', 'EXPENSE', 'ADJUSTMENT', 'TRANSFER']),

    stockItemId: z.string().min(1, 'Выберите номенклатуру топлива'),
    quantity: z.string().trim().regex(DECIMAL_3, 'Формат: 123 или 123.456 (до 3 знаков)'),

    stockLocationId: z.preprocess(trimToNull, z.string().nullable().optional()),
    fromLocationId: z.preprocess(trimToNull, z.string().nullable().optional()),
    toLocationId: z.preprocess(trimToNull, z.string().nullable().optional()),

    externalRef: z.preprocess(trimToNull, z.string().max(120).nullable().optional()),
    comment: z.preprocess(trimToNull, z.string().max(500).nullable().optional()),
  })
  .superRefine((val, ctx) => {
    const mt: StockMovementType = val.movementType;

    // quantity rules
    const q = val.quantity;
    const qNum = Number(q);
    if (mt !== 'ADJUSTMENT') {
      if (q.startsWith('-')) {
        ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Количество должно быть > 0' });
      }
      if (!(qNum > 0)) {
        ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Количество должно быть > 0' });
      }
    } else {
      // adjustment допускает +/-, но не 0
      if (!Number.isFinite(qNum) || qNum === 0) {
        ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Корректировка не может быть 0' });
      }
      if (!val.comment) {
        ctx.addIssue({ code: 'custom', path: ['comment'], message: 'Комментарий обязателен для корректировки' });
      }
    }

    if (mt === 'TRANSFER') {
      if (!val.fromLocationId) {
        ctx.addIssue({ code: 'custom', path: ['fromLocationId'], message: 'Выберите “Откуда”' });
      }
      if (!val.toLocationId) {
        ctx.addIssue({ code: 'custom', path: ['toLocationId'], message: 'Выберите “Куда”' });
      }
      if (val.fromLocationId && val.toLocationId && val.fromLocationId === val.toLocationId) {
        ctx.addIssue({ code: 'custom', path: ['toLocationId'], message: '“Куда” должно отличаться от “Откуда”' });
      }
    } else {
      if (!val.stockLocationId) {
        ctx.addIssue({ code: 'custom', path: ['stockLocationId'], message: 'Выберите локацию' });
      }
    }
  });

export type MovementFormValues = z.infer<typeof movementFormSchema>;

export function formToCreatePayload(values: MovementFormValues): CreateStockMovementPayload {
  const occurredAt = dateTimeLocalToIso(values.occurredAtLocal);

  if (values.movementType === 'TRANSFER') {
    return {
      occurredAt,
      movementType: 'TRANSFER',
      stockItemId: values.stockItemId,
      quantity: values.quantity,
      fromLocationId: values.fromLocationId!,
      toLocationId: values.toLocationId!,
      externalRef: values.externalRef ?? null,
      comment: values.comment ?? null,
    };
  }

  if (values.movementType === 'ADJUSTMENT') {
    return {
      occurredAt,
      movementType: 'ADJUSTMENT',
      stockItemId: values.stockItemId,
      quantity: values.quantity, // может быть отрицательной строкой
      stockLocationId: values.stockLocationId!,
      externalRef: values.externalRef ?? null,
      comment: values.comment!, // обязательна по schema
    };
  }

  // INCOME / EXPENSE
  return {
    occurredAt,
    movementType: values.movementType,
    stockItemId: values.stockItemId,
    quantity: values.quantity,
    stockLocationId: values.stockLocationId!,
    externalRef: values.externalRef ?? null,
    comment: values.comment ?? null,
  };
}
4) Колонки таблицы “Журнал движений топлива”
Ниже — конкретный рендер-слой: форматтеры + “route” колонка + ссылка на ПЛ.
Предполагаю, что у вас переход в карточку ПЛ делается через setView('WAYBILLS') + selectedWaybillId, либо через ваш текущий механизм. Я покажу вариант “просто callback”.

React

// components/warehouse/fuelMovementColumns.tsx
import React from 'react';
import type { StockLocation, StockMovement } from '../../services/api/stockApi';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function typeLabel(t: StockMovement['movementType']): string {
  switch (t) {
    case 'INCOME': return 'Приход';
    case 'EXPENSE': return 'Расход';
    case 'TRANSFER': return 'Перемещение';
    case 'ADJUSTMENT': return 'Корректировка';
  }
}

function typeClass(t: StockMovement['movementType']): string {
  switch (t) {
    case 'INCOME': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'EXPENSE': return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'TRANSFER': return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'ADJUSTMENT': return 'bg-amber-50 text-amber-900 border-amber-200';
  }
}

export function renderMovementRoute(
  m: StockMovement,
  locationsById: Map<string, StockLocation>
): React.ReactNode {
  const name = (id?: string | null, fallback?: string | null) => {
    if (!id) return fallback ?? '—';
    return (
      fallback ??
      locationsById.get(id)?.name ??
      id
    );
  };

  if (m.movementType === 'TRANSFER') {
    return (
      <span className="text-slate-900">
        {name(m.fromLocationId, m.fromLocationName)} <span className="text-slate-400">→</span> {name(m.toLocationId, m.toLocationName)}
      </span>
    );
  }

  return <span className="text-slate-900">{name(m.stockLocationId, m.stockLocationName)}</span>;
}

export function FuelMovementsTable(props: {
  items: StockMovement[];
  locationsById: Map<string, StockLocation>;
  onOpenWaybill?: (waybillId: string) => void;
}) {
  const { items, locationsById, onOpenWaybill } = props;

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Дата факта</th>
            <th className="px-3 py-2 text-left font-medium">Тип</th>
            <th className="px-3 py-2 text-left font-medium">Откуда / Куда</th>
            <th className="px-3 py-2 text-left font-medium">Топливо</th>
            <th className="px-3 py-2 text-right font-medium">Кол-во</th>
            <th className="px-3 py-2 text-left font-medium">Документ</th>
            <th className="px-3 py-2 text-left font-medium">Связь</th>
            <th className="px-3 py-2 text-left font-medium">Создано</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {items.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50/60">
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="font-medium text-slate-900">{formatDateTime(m.occurredAt)}</div>
                {typeof m.occurredSeq === 'number' ? (
                  <div className="text-xs text-slate-500">seq: {m.occurredSeq}</div>
                ) : null}
              </td>

              <td className="px-3 py-2 whitespace-nowrap">
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${typeClass(m.movementType)}`}>
                  {typeLabel(m.movementType)}
                </span>
              </td>

              <td className="px-3 py-2">
                {renderMovementRoute(m, locationsById)}
              </td>

              <td className="px-3 py-2 whitespace-nowrap text-slate-900">
                {m.stockItemName ?? m.stockItemId}
              </td>

              <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-slate-900">
                {m.quantity}
              </td>

              <td className="px-3 py-2 text-slate-700">
                {m.externalRef ? <span className="font-mono">{m.externalRef}</span> : <span className="text-slate-400">—</span>}
                {m.comment ? <div className="text-xs text-slate-500 line-clamp-2">{m.comment}</div> : null}
              </td>

              <td className="px-3 py-2 whitespace-nowrap">
                {m.relatedWaybillId ? (
                  <button
                    type="button"
                    className="text-blue-700 hover:underline"
                    onClick={() => onOpenWaybill?.(m.relatedWaybillId!)}
                  >
                    ПЛ
                  </button>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>

              <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                {formatDateTime(m.createdAt)}
              </td>
            </tr>
          ))}

          {items.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                Движений нет за выбранный период
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

Ниже — два готовых компонента, которые можно сразу подключать:

LocationSelect.tsx — единый селект локаций с группировкой (Склад / Карты / Баки)
FuelMovements.tsx + MovementCreateModal.tsx — фильтры, загрузка, пагинация, кнопка “Создать движение”, модал с RHF+Zod
Я использую ваши заготовки:

services/api/stockApi.ts
components/warehouse/movementSchemas.ts
components/warehouse/fuelMovementColumns.tsx (где FuelMovementsTable)
components/warehouse/LocationSelect.tsx
React

import React from 'react';
import type { StockLocation, StockLocationType } from '../../services/api/stockApi';

type Props = {
  label?: string;
  value: string;
  onChange: (next: string) => void;

  locations: StockLocation[];
  placeholder?: string;

  disabled?: boolean;
  required?: boolean;

  allowedTypes?: StockLocationType[]; // если нужно ограничить список
  includeEmptyOption?: boolean;       // default true
  emptyLabel?: string;               // default "—"
};

function typeTitle(t: StockLocationType): string {
  switch (t) {
    case 'WAREHOUSE':
      return 'Склад';
    case 'FUEL_CARD':
      return 'Топливные карты';
    case 'VEHICLE_TANK':
      return 'Баки ТС';
  }
}

function sortKey(l: StockLocation): string {
  // Склад -> карты -> баки, внутри по name
  const typeOrder: Record<StockLocationType, string> = {
    WAREHOUSE: '1',
    FUEL_CARD: '2',
    VEHICLE_TANK: '3',
  };
  return `${typeOrder[l.type]}:${(l.name ?? '').toLowerCase()}`;
}

export default function LocationSelect(props: Props) {
  const {
    label,
    value,
    onChange,
    locations,
    placeholder = 'Выберите локацию',
    disabled,
    required,
    allowedTypes,
    includeEmptyOption = true,
    emptyLabel = '—',
  } = props;

  const filtered = React.useMemo(() => {
    const base = allowedTypes ? locations.filter((l) => allowedTypes.includes(l.type)) : locations.slice();
    base.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    return base;
  }, [locations, allowedTypes]);

  const grouped = React.useMemo(() => {
    const map = new Map<StockLocationType, StockLocation[]>();
    for (const l of filtered) {
      const arr = map.get(l.type) ?? [];
      arr.push(l);
      map.set(l.type, arr);
    }
    return map;
  }, [filtered]);

  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm font-medium text-slate-700">{label}</div> : null}

      <select
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
      >
        {includeEmptyOption ? (
          <option value="">{placeholder || emptyLabel}</option>
        ) : null}

        {(Array.from(grouped.entries()) as Array<[StockLocationType, StockLocation[]]>).map(([type, arr]) => (
          <optgroup key={type} label={typeTitle(type)}>
            {arr.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
components/warehouse/MovementCreateModal.tsx
React

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { StockItem, StockLocation, StockMovementType } from '../../services/api/stockApi';
import { createStockMovement } from '../../services/api/stockApi';
import LocationSelect from './LocationSelect';
import { movementFormSchema, type MovementFormValues, formToCreatePayload } from './movementSchemas';

function toDateTimeLocalValue(d: Date): string {
  // yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

function humanizeError(err: unknown): string {
  // Подстройте под ваш httpClient/errors util при необходимости
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as any).message);
  }
  return 'Не удалось создать движение';
}

type Props = {
  isOpen: boolean;
  onClose: () => void;

  stockItems: StockItem[];
  locations: StockLocation[];

  defaultStockItemId?: string;
  defaultOccurredAtLocal?: string;

  onCreated?: () => void;
};

export default function MovementCreateModal(props: Props) {
  const { isOpen, onClose, stockItems, locations, defaultStockItemId, defaultOccurredAtLocal, onCreated } = props;

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: {
      occurredAtLocal: defaultOccurredAtLocal ?? toDateTimeLocalValue(new Date()),
      movementType: 'INCOME',
      stockItemId: defaultStockItemId ?? '',
      quantity: '',
      stockLocationId: '',
      fromLocationId: '',
      toLocationId: '',
      externalRef: '',
      comment: '',
    },
    mode: 'onSubmit',
  });

  const mt = form.watch('movementType') as StockMovementType;

  React.useEffect(() => {
    if (!isOpen) return;
    // при открытии модала можно мягко подставить stockItemId, если один
    if (!form.getValues('stockItemId') && stockItems.length === 1) {
      form.setValue('stockItemId', stockItems[0].id, { shouldDirty: false });
    }
  }, [isOpen, stockItems, form]);

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function onSubmit(values: MovementFormValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload = formToCreatePayload(values);
      await createStockMovement(payload);
      onCreated?.();
      onClose();
      form.reset({
        ...values,
        quantity: '',
        externalRef: '',
        comment: '',
      });
    } catch (e) {
      setServerError(humanizeError(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-base font-semibold text-slate-900">Создать движение топлива</div>
          <button
            type="button"
            className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form className="px-4 py-4" onSubmit={form.handleSubmit(onSubmit)}>
          {serverError ? (
            <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {serverError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Дата/время факта</div>
              <input
                type="datetime-local"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                {...form.register('occurredAtLocal')}
              />
              {form.formState.errors.occurredAtLocal ? (
                <div className="mt-1 text-xs text-rose-700">{form.formState.errors.occurredAtLocal.message}</div>
              ) : null}
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Тип движения</div>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                {...form.register('movementType')}
              >
                <option value="INCOME">Приход (поставщик → склад)</option>
                <option value="TRANSFER">Перемещение (склад ↔ карта ↔ бак)</option>
                <option value="EXPENSE">Расход (списание)</option>
                <option value="ADJUSTMENT">Корректировка</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Топливо</div>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                {...form.register('stockItemId')}
              >
                <option value="">Выберите…</option>
                {stockItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.stockItemId ? (
                <div className="mt-1 text-xs text-rose-700">{form.formState.errors.stockItemId.message}</div>
              ) : null}
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Количество</div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Напр. 50 или 12.5"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                {...form.register('quantity')}
              />
              {form.formState.errors.quantity ? (
                <div className="mt-1 text-xs text-rose-700">{form.formState.errors.quantity.message}</div>
              ) : null}
            </label>

            {mt === 'TRANSFER' ? (
              <>
                <div className="md:col-span-1">
                  <LocationSelect
                    label="Откуда"
                    value={form.watch('fromLocationId') ?? ''}
                    onChange={(v) => form.setValue('fromLocationId', v, { shouldDirty: true, shouldValidate: true })}
                    locations={locations}
                    placeholder="Выберите локацию"
                  />
                  {form.formState.errors.fromLocationId ? (
                    <div className="mt-1 text-xs text-rose-700">{String(form.formState.errors.fromLocationId.message)}</div>
                  ) : null}
                </div>

                <div className="md:col-span-1">
                  <LocationSelect
                    label="Куда"
                    value={form.watch('toLocationId') ?? ''}
                    onChange={(v) => form.setValue('toLocationId', v, { shouldDirty: true, shouldValidate: true })}
                    locations={locations}
                    placeholder="Выберите локацию"
                  />
                  {form.formState.errors.toLocationId ? (
                    <div className="mt-1 text-xs text-rose-700">{String(form.formState.errors.toLocationId.message)}</div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <LocationSelect
                  label="Локация"
                  value={form.watch('stockLocationId') ?? ''}
                  onChange={(v) => form.setValue('stockLocationId', v, { shouldDirty: true, shouldValidate: true })}
                  locations={locations}
                  placeholder="Выберите локацию"
                />
                {form.formState.errors.stockLocationId ? (
                  <div className="mt-1 text-xs text-rose-700">{String(form.formState.errors.stockLocationId.message)}</div>
                ) : null}
              </div>
            )}

            <label className="block md:col-span-2">
              <div className="mb-1 text-sm font-medium text-slate-700">Документ / номер / чек</div>
              <input
                type="text"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                {...form.register('externalRef')}
              />
            </label>

            <label className="block md:col-span-2">
              <div className="mb-1 text-sm font-medium text-slate-700">
                Комментарий {mt === 'ADJUSTMENT' ? <span className="text-rose-700">*</span> : null}
              </div>
              <textarea
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                {...form.register('comment')}
              />
              {form.formState.errors.comment ? (
                <div className="mt-1 text-xs text-rose-700">{String(form.formState.errors.comment.message)}</div>
              ) : null}
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Отмена
            </button>

            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Сохранение…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
components/warehouse/FuelMovements.tsx
React

import React from 'react';

import {
  getStockItems,
  getStockLocations,
  getStockMovements,
  type GetStockMovementsQuery,
  type StockItem,
  type StockLocation,
  type StockMovementType,
} from '../../services/api/stockApi';

import MovementCreateModal from './MovementCreateModal';
import { FuelMovementsTable } from './fuelMovementColumns';
import { dateTimeLocalToIso } from './movementSchemas';

function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

function startOfTodayLocal(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toDateTimeLocalValue(d);
}

function endOfTodayLocal(): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0); // минутная точность для datetime-local
  return toDateTimeLocalValue(d);
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

function isTruthy(s: string | undefined | null): boolean {
  return !!(s && s.trim().length > 0);
}

export default function FuelMovements(props: {
  canCreate?: boolean; // RBAC: показывать кнопку “Создать движение”
  onOpenWaybill?: (waybillId: string) => void;
}) {
  const { canCreate = true, onOpenWaybill } = props;

  // filters (datetime-local strings in UI)
  const [occurredFromLocal, setOccurredFromLocal] = React.useState<string>(startOfTodayLocal());
  const [occurredToLocal, setOccurredToLocal] = React.useState<string>(endOfTodayLocal());

  const [movementType, setMovementType] = React.useState<StockMovementType | ''>('');
  const [stockItemId, setStockItemId] = React.useState<string>('');
  const [locationId, setLocationId] = React.useState<string>('');
  const [q, setQ] = React.useState<string>('');

  const qDebounced = useDebounced(q, 350);

  // data
  const [stockItems, setStockItems] = React.useState<StockItem[]>([]);
  const [locations, setLocations] = React.useState<StockLocation[]>([]);
  const locationsById = React.useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const [items, setItems] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [page, setPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(50);

  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  // bootstrap: items + locations
  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [si, loc] = await Promise.all([getStockItems(), getStockLocations()]);
        if (cancelled) return;
        setStockItems(si);
        setLocations(loc);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Не удалось загрузить справочники склада');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const query: GetStockMovementsQuery = React.useMemo(() => {
    const occurredFrom = isTruthy(occurredFromLocal) ? dateTimeLocalToIso(occurredFromLocal) : undefined;
    const occurredTo = isTruthy(occurredToLocal) ? dateTimeLocalToIso(occurredToLocal) : undefined;

    return {
      occurredFrom,
      occurredTo,
      movementType: movementType || undefined,
      stockItemId: stockItemId || undefined,
      locationId: locationId || undefined,
      q: qDebounced.trim() || undefined,
      page,
      pageSize,
      orderBy: 'occurredAt:desc',
    };
  }, [occurredFromLocal, occurredToLocal, movementType, stockItemId, locationId, qDebounced, page, pageSize]);

  // load movements
  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getStockMovements(query);
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Не удалось загрузить журнал движений');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  // reset page when filters (except page/pageSize) change
  React.useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occurredFromLocal, occurredToLocal, movementType, stockItemId, locationId, qDebounced]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const activeFilterChips = React.useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (movementType) {
      chips.push({
        key: 'movementType',
        label: `Тип: ${movementType}`,
        onRemove: () => setMovementType(''),
      });
    }
    if (stockItemId) {
      const name = stockItems.find((x) => x.id === stockItemId)?.name ?? stockItemId;
      chips.push({
        key: 'stockItemId',
        label: `Топливо: ${name}`,
        onRemove: () => setStockItemId(''),
      });
    }
    if (locationId) {
      const name = locationsById.get(locationId)?.name ?? locationId;
      chips.push({
        key: 'locationId',
        label: `Локация: ${name}`,
        onRemove: () => setLocationId(''),
      });
    }
    if (qDebounced.trim()) {
      chips.push({
        key: 'q',
        label: `Поиск: ${qDebounced.trim()}`,
        onRemove: () => setQ(''),
      });
    }
    return chips;
  }, [movementType, stockItemId, locationId, qDebounced, stockItems, locationsById]);

  function resetFilters() {
    setOccurredFromLocal(startOfTodayLocal());
    setOccurredToLocal(endOfTodayLocal());
    setMovementType('');
    setStockItemId('');
    setLocationId('');
    setQ('');
    setPage(1);
    setPageSize(50);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <div className="mb-1 text-sm font-medium text-slate-700">Период (дата факта)</div>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={occurredFromLocal}
                onChange={(e) => setOccurredFromLocal(e.target.value)}
              />
              <input
                type="datetime-local"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={occurredToLocal}
                onChange={(e) => setOccurredToLocal(e.target.value)}
              />
            </div>
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-slate-700">Тип</div>
            <select
              className="w-56 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as any)}
            >
              <option value="">Все</option>
              <option value="INCOME">Приход</option>
              <option value="TRANSFER">Перемещение</option>
              <option value="EXPENSE">Расход</option>
              <option value="ADJUSTMENT">Корректировка</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-slate-700">Топливо</div>
            <select
              className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={stockItemId}
              onChange={(e) => setStockItemId(e.target.value)}
            >
              <option value="">Все</option>
              {stockItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>

          <div className="min-w-[260px] flex-1">
            {/* универсальный фильтр локации */}
            <div className="mb-1 text-sm font-medium text-slate-700">Локация</div>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">Все</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <label className="block flex-1 min-w-[240px]">
            <div className="mb-1 text-sm font-medium text-slate-700">Поиск</div>
            <input
              type="text"
              placeholder="Документ, комментарий…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={resetFilters}
            >
              Сбросить
            </button>

            {canCreate ? (
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                onClick={() => setIsCreateOpen(true)}
              >
                Создать движение
              </button>
            ) : null}
          </div>
        </div>

        {activeFilterChips.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {activeFilterChips.map((c) => (
              <button
                key={c.key}
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                onClick={c.onRemove}
                title="Убрать фильтр"
              >
                <span>{c.label}</span>
                <span className="text-slate-400">✕</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {isLoading ? 'Загрузка…' : `Найдено: ${total}`}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">
            На странице:{' '}
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </button>

          <div className="text-sm text-slate-700">
            {page} / {totalPages}
          </div>

          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            →
          </button>
        </div>
      </div>

      <FuelMovementsTable
        items={items as any}
        locationsById={locationsById}
        onOpenWaybill={onOpenWaybill}
      />

      <MovementCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        stockItems={stockItems}
        locations={locations}
        defaultOccurredAtLocal={toDateTimeLocalValue(new Date())}
        onCreated={async () => {
          // после создания — просто перезагрузим текущую страницу
          const res = await getStockMovements(query);
          setItems(res.items as any);
          setTotal(res.total);
        }}
      />
    </div>
  );
}
Как подключить в Warehouse.tsx
Если у вас уже есть контейнер, просто вставьте:

React

import FuelMovements from './FuelMovements';

export default function Warehouse() {
  return (
    <div className="p-4">
      <FuelMovements
        canCreate={true /* подставить RBAC */}
        onOpenWaybill={(id) => {
          // подставьте ваш механизм навигации/открытия карточки ПЛ
          console.log('open waybill', id);
        }}
      />
    </div>
  );
}
Маленькая, но важная ремарка про “Локация” в фильтре
В FuelMovements.tsx я сделал фильтр локации простым <select>, чтобы не блокировать работу. Если хотите сразу красиво и правильно — замените его на LocationSelect (тот же компонент), просто с includeEmptyOption.


Цель
Playwright должен открывать приложение по /_PL-tests/…, а тесты должны использовать только относительные переходы (page.goto('/login')), чтобы basePath не ломал запуск.

PR-1 — playwright.config.ts: baseURL + webServer.url с /_PL-tests
Что сделать
Открыть playwright.config.ts
Ввести 3 env-переменные (с дефолтами):
E2E_PORT (default 3000)
E2E_BASE_PATH (default /_PL-tests)
E2E_BASE_URL (опционально)
Выставить:
use.baseURL = http://localhost:<port>/_PL-tests
webServer.url = тот же baseURL
webServer.command — без изменений (просто стартует npm run dev)
Готовый код для вставки
TypeScript

import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_PATH = process.env.E2E_BASE_PATH ?? '/_PL-tests';
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}${BASE_PATH}`;

export default defineConfig({
  use: {
    baseURL: BASE_URL,
  },

  webServer: {
    command: `npm run dev -- --host --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
Критерий приёмки
В логах Playwright webServer “ждёт” URL вида http://localhost:3000/_PL-tests
page.goto('/') открывает приложение (фактически /_PL-tests/)
PR-2 — Убрать абсолютные URL из E2E тестов
Что сделать
Поиск по репо:
http://localhost:3000
localhost:3000
page.goto('http
Заменить на относительные пути:
page.goto('/')
page.goto('/login')
page.goto('/waybills') и т.п.
Если где-то используются API-запросы в тестах через request, либо:
передавать baseURL в request.newContext({ baseURL }), либо
также использовать относительные пути.
Критерий приёмки
grep -R "localhost:3000" tests (или вся репа) — пусто
Тесты не пытаются открыть /, минуя basePath
PR-3 — Smoke-test, чтобы больше не ловить “Vite заглушку”
Что сделать
Добавить тест tests/e2e/smoke.spec.ts:

TypeScript

import { test, expect } from '@playwright/test';

test('app boots under basePath', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('body')).not.toContainText('Вы имели в виду /_PL-tests');
});
Критерий приёмки
Smoke проходит локально и в CI
Если basePath снова сломают, тест падает сразу и понятно
PR-4 — (если нужно) Проверка SPA fallback для /login
Если после PR-1/2 page.goto('/login') даёт 404, это не Playwright, а dev/proxy.

Что сделать
Вручную открыть в браузере:
http://localhost:3000/_PL-tests/login
Если 404:
проверить, что реально стартует Vite dev server (он обычно отдаёт SPA fallback)
если стоит прокси/сервер, добавить rewrite всех /_PL-tests/* на /_PL-tests/index.html
Критерий приёмки
Прямой заход на /_PL-tests/login открывает приложение
Итоговый чек после всех PR
npm run test:e2e стартует сервер, открывает /_PL-tests/login, проходит логин и сценарии WH-008 без ручных подстановок URL.
В тестах нет хардкода адреса сервера.

автозаполнение данных ПЛ при выборе авто
Сделаем это как отдельную, предсказуемую фичу: выбор ТС → запрос “prefill” → аккуратно заполнить форму ПЛ, не ломая уже введённые пользователем поля.

AF-001 — Backend: endpoint “prefill для ПЛ” по vehicleId
Что сделать
1) Добавить endpoint

GET /waybills/prefill?vehicleId=<id>&at=<iso?>
vehicleId обязателен
at опционально (если не передали — используем now() или waybill.startAt, если он уже задан на фронте)
2) DTO ответа (пример)

TypeScript

type WaybillPrefillResponse = {
  vehicle: {
    id: string;
    registrationNumber: string;
    fuelTypeId: string | null;
    fuelConsumptionRates: any | null;
    isActive: boolean;
  };
  suggested: {
    driverId: string | null;        // ВАЖНО: Driver.id
    dispatcherEmployeeId: string | null;
    controllerEmployeeId: string | null;
    odometerStart: number | null;
    fuelAtStart: number | null;
    fuelCalculationMethod: 'BOILER' | 'SEGMENTS' | 'MIXED' | null;
  };
  sources: {
    driver: 'LAST_WAYBILL' | 'DEPARTMENT_DEFAULT' | 'NONE';
    dispatcher: 'LAST_WAYBILL' | 'CURRENT_USER' | 'DEPARTMENT_DEFAULT' | 'NONE';
    controller: 'LAST_WAYBILL' | 'DEPARTMENT_DEFAULT' | 'NONE';
    odometerStart: 'LAST_WAYBILL' | 'NONE';
    fuelAtStart: 'LAST_WAYBILL' | 'TANK_BALANCE_AS_OF' | 'NONE';
  };
};
3) Логика подбора значений (детерминированно)

vehicle: грузим по organizationId (и departmentId если у вас такое правило), проверяем активность.
lastWaybill для этого ТС (в этой org):
берём самый свежий POSTED (или POSTED+SUBMITTED, но лучше POSTED) по endAt/postedAt.
odometerStart:
если есть lastWaybill.odometerEnd → это и есть odometerStart
fuelAtStart:
вариант 1 (быстрее): lastWaybill.fuelAtEnd
вариант 2 (если уже есть бак-учёт и balance API): tankBalanceAsOf(startAt) — это более “правильно”, но если не везде надёжно, можно держать fallback на lastWaybill.fuelAtEnd
driverId:
строго lastWaybill.driverId (это уже Driver.id)
если нет — null (лучше, чем пытаться угадать по Employee)
dispatcher/controller:
если в Waybill уже есть поля dispatcherEmployeeId/controllerEmployeeId — берём из lastWaybill
дополнительно: если текущий user имеет роль dispatcher и связан с Employee — можно подставлять “CURRENT_USER” как fallback
если у Department есть дефолты (если вы их вводили) — fallback на них
4) RBAC

Доступ: тот же, что и на создание/редактирование ПЛ (минимум waybill.create / waybill.update).
Плюс стандартная изоляция organizationId.
Что это решает
Frontend перестаёт “тащить” кучу справочников и собирать догадки — он получает один консистентный ответ “что подставить и почему”.
AF-002 — Frontend: автозаполнение в WaybillDetail при выборе ТС
Что сделать
1) Интеграция запроса

В services/api/waybillApi.ts добавить:
getWaybillPrefill(vehicleId, at?)
2) UX-правило “не перетирай руками введённое”
В WaybillDetail.tsx при выборе ТС:

вызываем prefill
применяем значения только в поля, которые пустые, или если это новый ПЛ (создание)
если ПЛ не новый и поля уже заполнены — показать модал:
“Заполнить только пустые” (default)
“Перезаписать связанные поля (водитель/одометр/остаток)” (опасная кнопка)
Технически в RHF:

использовать formState.dirtyFields + getValues() и setValue() только для пустых/не dirty.
3) Какие поля заполняем
Минимальный набор (то, что реально ждут пользователи):

vehicleId (уже выбран)
driverId (Driver.id!)
dispatcherEmployeeId
controllerEmployeeId
odometerStart
fuelAtStart
(опционально) fuelCalculationMethod/нормы — если это часть формы ПЛ
4) Отображение “откуда взялось” (очень полезно)
Рядом с автозаполненными значениями (или в тултипе) показать:

“Из последнего ПЛ”
“Из настроек подразделения”
“Текущий пользователь”
Это прямо из response.sources.
Что это решает
Пользователь получает “выбрал авто — всё подставилось”, но мы не создаём баг-класс “я уже заполнил, а оно перетёрлось”.
AF-003 — Инварианты: Driver ≠ Employee в автозаполнении
Что сделать
На фронте поле водителя в ПЛ должно быть driverId.
В prefill-ответе водитель возвращается только как Driver.id.
Если нужно показать ФИО — отдавать вместе driver.employee.fullName (join), но сохранять всё равно driverId.
Что это решает
Не повторяем старую яму “фронт шлёт employeeId, а бэк ждёт driverId”.
AF-004 — Тесты автозаполнения
Что сделать
Backend tests

Есть POSTED ПЛ по ТС → prefill возвращает:
odometerStart = last.odometerEnd
driverId = last.driverId
fuelAtStart = last.fuelAtEnd (или tank-balance, если включено)
Нет прошлых ПЛ → значения null, но vehicle возвращается.
Тенантность: запрос с другим organizationId не видит vehicle/waybill.
Frontend (минимум)

При выборе ТС пустая форма заполняется.
При выборе ТС с уже заполненным driver/odometer:
“только пустые” не перетирает
“перезаписать” перетирает
AF-005 — Диагностика и логирование (чтобы поддержка не страдала)
Что сделать
Backend: логировать prefill с vehicleId, userId, orgId, и sources.
Frontend: при ошибке prefill показывать понятное сообщение (“не удалось подтянуть данные по ТС”) без падения формы.
Если завтра вы делаете это “одним заходом”, оптимальная последовательность: AF-001 → AF-002 → AF-003 → AF-004, а AF-005 в конце.
================================================================================================
REL-200 — Справочник “Номенклатура” (Stock Items) + перенос “Типы топлива” в него
Проблема
Склад/движения топлива не используют справочник “Типы топлива”, потому что:

“Типы топлива” живут как отдельный домен/справочник,
а склад ожидает “номенклатуру” (товары/ТМЦ), которой нет,
из-за этого склад не может корректно работать с несколькими видами топлива, единицами измерения и дальнейшим расширением (масла, расходники).
Цель
Ввести единый справочник Номенклатура (StockItem) и мигрировать существующие Типы топлива в номенклатуру как элементы категории “Fuel”.

REL-201 — Backend: модели Prisma + миграция данных
Что сделать
1) Prisma модели
Добавить модель StockItem и enum категории:

prisma

enum StockItemCategory {
  FUEL
  MATERIAL
  SPARE_PART
  SERVICE
  OTHER
}

model StockItem {
  id             String @id @default(cuid())
  organizationId String
  departmentId   String?
  category       StockItemCategory
  name           String
  code           String? // артикул/код
  unit           String  @default("л") // для топлива по умолчанию литры
  isActive       Boolean @default(true)

  // для топлива полезно:
  fuelTypeLegacyId String? // временно для миграции/совместимости (опционально)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, name])
  @@index([organizationId, category])
}
2) Связи склада
В StockMovement (и StockBalance, если есть) использовать stockItemId → StockItem.id.
Убедиться, что API /stock/items возвращает StockItem[].
3) Миграция “Типы топлива” → StockItem
Сценарий:

Для каждой организации:
взять все записи из существующего FuelType (или как он у вас называется)
создать StockItem с:
category = FUEL
name = fuelType.name
unit = "л"
fuelTypeLegacyId = fuelType.id (временная связь)
После миграции:
обновить все ссылки (если где-то в ПЛ/ТС хранится fuelTypeId) — см. ниже REL-202.
4) Обратная совместимость (временно)
Если фронт/части бэка ещё используют старый /fuel-types:

оставить эндпоинт, но делать его thin-wrapper поверх StockItem where category=FUEL.
добавить warning-лог: “fuel-types deprecated, use stock-items?category=FUEL”.
Что это решает
Склад начинает опираться на полноценную номенклатуру.
“Топливо” становится одним из типов stock item, и вы можете расширять склад на масла/запчасти без нового домена.
REL-202 — Backend: контракт API для “топлива” и миграция ссылок доменов
Что сделать
Waybill / WaybillFuel
Если в ПЛ сейчас есть fuelTypeId:
заменить на fuelItemId (FK на StockItem)
или держать оба поля на переходный период:
fuelTypeId (deprecated)
stockItemId (new)
в сервисе POSTED использовать stockItemId для движений склада.
Vehicle
Если у ТС есть “тип топлива”:
тоже перевести на fuelItemId (StockItem категории FUEL)
либо отображать в UI через join.
DTO/валидация
Везде, где ожидается топливо для склада — требовать stockItemId, а не fuelTypeId.
Что это решает
Склад и ПЛ начинают говорить на одном языке идентификаторов.
REL-203 — Frontend: новый справочник “Номенклатура” + вкладка “Топливо” как фильтр
Что сделать
Добавить экран/вкладку в Dictionaries или Warehouse:
“Номенклатура”
Фильтры: категория (по умолчанию Fuel)
CRUD: создать/редактировать/архивировать
В местах выбора топлива:
в складе (движения/остатки) — использовать /stock/items (category=FUEL)
в ПЛ — выбирать из того же списка (Fuel items)
Старый экран “Типы топлива”
либо убрать,
либо оставить как “alias” на номенклатуру с категорией Fuel (на переходный период), с пометкой “устаревает”.
Что это решает
Пользователь видит один справочник, не дублирует сущности, склад сразу работает корректно.
REL-204 — Тесты и миграция
Что сделать
DB seed
сидировать минимум 1–2 StockItem(FUEL) на организацию (например ДТ, АИ-92)
E2E складу не нужен “FuelTypes” вообще
Regression tests
E2E: создание INCOME/TRANSFER использует stockItemId из /stock/items
Unit: миграция не создаёт дублей @@unique(orgId, name)
Решение по именованию (важно)
Справочник называем “Номенклатура” (это понятно бухгалтерам/складу).
“Типы топлива” превращаются в категорию “Топливо” внутри номенклатуры.

MIG-FT-004 — Prisma/DB: миграция ссылок и удаление legacy полей
Фаза A (совместимость)
- [x] В Vehicle добавить fuelItemId (использован fuelStockItemId).
- [x] Скрипт backfill: довести до идемпотентности и заполнять Vehicle.fuelStockItemId.
- [x] Backend чтение: возвращать fuelStockItemId в API.
Фаза B (очистка)
- [ ] Удалить FuelType модель/таблицу и fuelTypeId.
- [ ] Удалить роуты/сервис/controller FuelType.

MIG-FT-005 — Tests (E2E): Rewrite to StockItem
- [x] full-business-chain.e2e.spec.ts: replace /fuel-types with /stock/items.
- [x] POST /fuel-types: ensure disabled (410).