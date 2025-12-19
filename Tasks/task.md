Новая стратегия: “контекст → инварианты → автоматические проверки”
1) Контекст должен стать видимым и проверяемым
Сейчас половина “багов” — это не баги, а не тот organizationId в токене, не тот employeeId/driverId, не тот departmentId.

REL-001 — /me и “панель контекста” в UI
Что сделать

Backend: добавить эндпоинт GET /me (или /auth/me), который возвращает:
userId, role
organizationId + organizationName
departmentId + departmentName
(опционально) employeeId, driverId (если есть связь)
Frontend: в шапке приложения всегда показывать:
Организация / Подразделение / Роль
кнопку “Скопировать диагностический пакет” (JSON из /me + версия фронта/бэка)
Что это решает

“Справочники пустые” сразу объясняется: “Вы в Оптима, данные в Минсельхоз”.
Агент перестаёт гадать по косвенным признакам.
REL-002 — Явные сообщения “пусто потому что контекст”
Если список пустой, UI должен различать:

403 “нет прав”
200 пусто “в этой организации нет данных”
200 пусто “вы фильтруете по departmentId=null/конкретному”
409/400 доменные ошибки
2) Инварианты домена должны соблюдаться автоматически
Примеры твоих “отваливаний” — это нарушение инвариантов:

“Водитель не найден” потому что фронт шлёт employeeId, а бэк ждёт driverId.
“Бланки водителя не отображаются” потому что у сотрудника нет записи Driver.
“Три Иванова” → UI выбирает не того человека.
REL-010 — Стандартизировать идентичности: Employee ≠ Driver
Правило

Везде, где речь про “водителя” (ПЛ, выдача/резерв/сводка бланков) — используется Driver.id.
Справочник сотрудников может быть Employee, но “водитель” — это Employee + Driver.
Практическая реализация

UI “выбор водителя” должен подгружать список Drivers (join на Employee для ФИО), а не Employees.
Backend: временно можно поддерживать fallback employeeId→driverId, но:
логировать warning,
постепенно запретить и оставить только driverId.
REL-011 — Инвариант “если employeeType=driver, должен существовать Driver”
Что сделать

При создании/изменении Employee.employeeType = 'driver':
автоматически создавать/обеспечивать запись Driver (с employeeId)
В UI справочника “Сотрудники” показывать бейдж:
“Driver: есть/нет”
и давать кнопку “Создать запись водителя” (админ/диспетчер)
Это убирает класс багов “у сотрудника нет driver, поэтому всё пусто”.

3) Договор API и DTO: одна правда, без расхождений
Ты уже видел это на примере number (обязательное в Zod, хотя сервер присваивает из бланка). Это системная проблема: контракт живёт в нескольких местах.

REL-020 — Единый контракт DTO
Что сделать

Вынести DTO схемы (Zod) и типы в одно место и использовать:
в контроллере (валидация)
на фронте (типизация/генерация)
Любое изменение схемы должно сопровождаться:
обновлением типов
контрактным тестом
4) Автоматические проверки: “золотой путь” должен быть зелёным всегда
Сейчас вы чините по отдельным симптомам, но нет “красной лампы”, которая бы загоралась, когда ломается базовый сценарий.

REL-030 — E2E smoke “золотой путь”
Один тестовый сценарий должен запускаться локально/в CI и гарантировать, что система “держится”:

Создать организацию/подразделение (или использовать seed)
Создать сотрудника‑водителя → авто‑создался Driver
Создать ТС с нормами
Создать пачку бланков → материализация
Выдать бланки Driver
Создать ПЛ (номер присваивается из бланка, reserve)
Провести POSTED (списание + USED + audit)
Если этот тест красный — никакие частные фиксы не мёржатся.

REL-031 — Seed “демо‑данные без сюрпризов”
Нужен один стабильный seed, где:

нет дублей ФИО без идентификаторов
у каждого driver‑employee есть Driver
у текущего тест‑юзера правильная organizationId
есть ТС/топливо/склад/бланки
Почему у вас “всё разваливается” именно так (корень)
Ты привёл два повторяющихся класса проблем:

Контекст (organizationId в токене) не совпадает с данными

данные перенесли в другую организацию
токен/пользователь остался в старой
UI не показывает, где вы сейчас
Сущности “похожи”, но не эквивалентны

Employee vs Driver
один и тот же ФИО у нескольких записей
UI выбирает по имени, а данные привязаны по ID
Эти два класса проблем решаются не “фиксом тут/там”, а пунктами REL‑001/010/011.

Прямо сейчас: следующий набор тикетов “стабилизации” (минимум, но мощно)
REL-001 /me + UI‑баннер контекста + “копировать debug JSON”
REL-010 “водитель = Driver” во всех местах (селекторы, бланки, ПЛ)
REL-011 авто‑создание Driver для employeeType=driver + бейдж “Driver: нет”
REL-030 e2e smoke “золотой путь”
REL-002 UI различает “пусто/нет прав/не та организация/ошибка”

EPIC REL-100 — Наблюдаемость и контекст
REL-101 — [x] Backend: requestId middleware + X-Request-Id
Task
Добавить requestId на каждый запрос и прокинуть в ответы.

Files

backend/src/middleware/requestId.ts (new)
backend/src/app.ts или backend/src/server.ts
Steps

Реализовать middleware: если x-request-id не пришёл — генерировать UUID.
Ставить res.setHeader('X-Request-Id', requestId).
Подключить middleware до роутов.
Expected result

Каждый ответ API содержит X-Request-Id.
Tests

Integration: любой GET возвращает X-Request-Id.
REL-102 — [x] Backend: errorHandler логирует requestId + контекст
Task
Сделать диагностируемыми 500/400/403: логировать requestId + userId + orgId + route + code.

Files

backend/src/middleware/errorHandler.ts (или ваш общий обработчик ошибок)
Steps

В error handler печатать structured log: { requestId, userId, organizationId, path, code, message }.
В JSON-ошибках возвращать requestId (в теле), если это ваш формат ошибок.
Expected result

Любая серверная ошибка привязана к конкретному запросу.
Tests

Integration: искусственно вызвать 400/500 и проверить наличие requestId в логе/ответе (в зависимости от реализации).
REL-103 — [x] Backend: GET /me (контекст с org/dept/role)
Task
Добавить эндпоинт, который возвращает контекст текущей сессии (кто/где.

Files

backend/src/controllers/meController.ts (new)
backend/src/routes/meRoutes.ts (new)
backend/src/app.ts (подключение)
Steps

Реализовать GET /me под authMiddleware.
Возвращать: user(id,email,fullName,role), organization(id,name), department(id,name|null), tokenClaims(orgId,deptId), serverTime, requestId.
Expected result

По одному запросу видно, почему списки пустые (не та организация/департамент/роль).
Tests

Integration: GET /me с JWT → 200 и ожидаемая структура.
Negative: без JWT → 401.
EPIC REL-200 — Видимый контекст в UI и корректные пустые состояния
[x] REL-201 — Frontend: API client /me
Task
Добавить вызов /me на фронте.

Files

frontend/src/services/api/meApi.ts (new)
Steps

Реализовать getMe().
Expected result

Фронт может загрузить контекст.
Tests

Typecheck/build.
[x] REL-202 — Frontend: MeProvider (глобальное состояние контекста)
Task
Создать провайдер/контекст, который грузит /me и хранит статус (loading/ready/unauth/error).

Files

frontend/src/state/MeContext.tsx (new)
Steps

Реализовать провайдер и хук useMe().
Expected result

Контекст доступен всем компонентам.
Tests

UI smoke: приложение не падает при 401/500.
REL-203 — Frontend: ContextBar в шапке + “Скопировать диагностику”
Task
Показывать текущую org/dept/role и давать кнопку копирования диагностического JSON.

Files

frontend/src/components/ContextBar.tsx (new)
frontend/src/App.tsx (подключение MeProvider + ContextBar)
Steps

Отрендерить контекстную панель, когда me готов.
Кнопка копирует JSON: { me, appVersion, time, userAgent }.
Expected result

Пользователь видит “в какой организации он сейчас”.
Диагностика отправляется одним кликом.
Tests

UI smoke: копирование не ломает (если clipboard недоступен — показать error toast/alert).
REL-204 — [/] Frontend: пустые состояния в справочниках/журналах (403/500/empty)
Task
Развести причины “пусто”: нет прав vs ошибка vs реально нет данных.

Files

страницы/виджеты журналов и справочников:
frontend/src/pages/Waybills*.tsx (WaybillList.tsx)
frontend/src/components/admin/BlankManagement.tsx
frontend/src/components/dictionaries/* (Vehicles, Employees)

Steps

[x] Создать компонент `EmptyState.tsx` (консолидирован в `common/EmptyState.tsx`)
[x] Обновить `httpClient.ts` для проброса `requestId` и `code`
[x] Интегрировать `EmptyState` в `WaybillList.tsx`
[x] Интегрировать `EmptyState` в `BlankManagement.tsx`
[x] Интегрировать `EmptyState` в `VehicleList.tsx` и `EmployeeList.tsx`
[x] Сорри, я забыл обновить статус REL-304 в предыдущем шаге (уже сделано).
Expected result

“Пусто” больше не маскирует проблемы.
Tests

UI: мокнуть ответы 403/500/[] и проверить разные сообщения.
EPIC REL-300 — Инварианты Driver vs Employee (устранение “Ивановых”)
[x] REL-301 — Backend: endpoint GET /drivers (join Employee)
Task
Дать фронту единый “список водителей” как сущность Driver + данные Employee.

Files

backend/src/routes/driverRoutes.ts (new)
backend/src/controllers/driverController.ts (new)
backend/src/services/driverService.ts (new)
Steps

GET /drivers возвращает массив: { id (driverId), employeeId, fullName, departmentId, isActive }.
Фильтр по organizationId. Опционально: если задан req.user.departmentId — фильтровать по нему.
Expected result

UI выбирает водителя по Driver.id, а не по Employee.
Tests

Integration: в org с сотрудниками-водителями эндпоинт возвращает их.
REL-302 — Backend: инвариант “employeeType=driver ⇒ Driver существует”
Task
Автосоздание записи Driver для сотрудников типа driver.

Files

backend/src/services/employeeService.ts
backend/src/controllers/employeeController.ts
Steps

При create/update employee:
если employeeType === 'driver' и Driver нет — создать.
При смене типа с driver на другой:
запретить, если есть связанные бланки/ПЛ (или оставить Driver как исторический; выбрать одну политику и зафиксировать).
Expected result

Не бывает “водитель без Driver”, из-за чего пустеют бланки/ПЛ.
Tests

Integration: создать employee(driver) → driver создан.
Integration: update employee(non-driver→driver) → driver создан.
[x] REL-303 — Backend: прекратить путаницу employeeId/driverId в waybill/blank API
Task
Сделать контракты строгими: в домене ПЛ/бланков используется driverId = Driver.id.

Files

backend/src/dto/*.ts (zod DTO)
backend/src/controllers/waybillController.ts
backend/src/controllers/blankController.ts (если есть “по водителю”)
backend/src/services/waybillService.ts
backend/src/services/blankService.ts
Steps

В DTO чётко назвать поле driverId и валидировать UUID.
В сервисах убрать логику, где driverId иногда трактуется как employeeId.
На переходный период сделать fallback:
если по driverId не найден Driver, попробовать трактовать как employeeId
если найден — лог warning DEPRECATED_EMPLOYEE_ID_AS_DRIVER_ID
если не найден — 409 EMPLOYEE_HAS_NO_DRIVER_RECORD
Expected result

Больше нет “выбрали сотрудника — бланки пустые”, если он не Driver.
Ошибка становится явной и понятной.
Tests

Integration: запрос с employeeId вместо driverId → либо успешный fallback, либо 409 с кодом (если Driver не существует).
REL-304 — [x] Frontend: заменить селекторы “водитель” на /drivers
Task
Все места выбора водителя переводим на Driver.id.

Files

frontend/src/services/api/driverApi.ts (new)
форма ПЛ, выдача бланков, фильтры журналов
Steps

[x] Backend: эндпоинт GET /drivers уже готов.
[x] Создать frontend driverApi.ts и типы.
[x] Обновить WaybillDetail.tsx: заменить Employee select на Driver select.
[x] Обновить Blank management (выдача бланков): заменить на Driver.
[x] Исправить фильтры в журналах (WaybillList, BlankList).
Expected result

В UI невозможно “выбрать сотрудника без Driver” в сценариях водителя.
Tests

UI smoke: создание ПЛ отправляет driverId (Driver.id).
EPIC REL-400 — [x] Управление организационным контекстом (чтобы не “переезжали данные”)
[x] REL-401 — Backend: admin endpoint “переназначить пользователя на организацию”
Task
Сделать безопасный инструмент смены org/dept пользователя без ручной правки БД.

Files

backend/src/routes/adminRoutes.ts (new/extend)
backend/src/controllers/adminUserController.ts (new)
backend/src/middleware/checkPermission.ts (использовать admin-only)
Prisma: User
Steps

Endpoint: POST /admin/users/:id/set-org body: { organizationId, departmentId? }.
Валидация: org/dept существуют, dept принадлежит org.
Обновить user.organizationId, user.departmentId.
Expected result

Админ может привести пользователя в нужную организацию (“Минсельхоз”), чтобы справочники не были пустыми.
Tests

Integration: смена org → GET /me после перелогина показывает новую org.
[x] REL-402 — Backend: revoke refresh tokens при смене org/dept
Task
Чтобы не было “старых токенов” с прежней организацией.

Files

backend/src/controllers/adminUserController.ts
Prisma: RefreshToken
Steps

После смены org/dept:
пометить все refresh tokens пользователя как revoked (revokedAt = now()).
(Если есть endpoint refresh) убедиться, что revoked token не обновляет сессию.
Expected result

Пользователь вынужден перелогиниться и получает JWT с актуальным orgId.
Tests

Integration: после смены org → refresh не работает со старыми токенами.
EPIC REL-500 — “Золотой путь” и демо-данные (страховочная сетка)
[x] REL-501 — Backend: demo seed без ловушек контекста
Task
Один seed создаёт “правильную” организацию, пользователей и данные.

Files

backend/scripts/seedDemo.ts (new)
Steps

Создать org “Минсельхоз demo” + dept.
Создать пользователей admin/dispatcher/driver (предсказуемые логины).
Создать employee(driver) + Driver.
Создать vehicle с fuelConsumptionRates.
Создать StockItem(isFuel).
Создать blankBatch + blanks + issue to driver.
Вывести в консоль: логины, organizationId, driverId.
Expected result

После seed приложение сразу “живое”, без переносов данных между org.
Tests

Smoke: seed проходит на чистой БД.
[x] REL-502 — E2E: golden path тест (бланки → ПЛ → POSTED)
Task
Один тест ловит регрессии “система развалилась”.

Files

backend/tests/e2e/goldenPath.test.ts (new)
тестовый раннер (jest/vitest) конфиг проекта
Steps

Поднять тестовую БД.
Через Prisma создать org/dept/user/driver/vehicle/stockItem/blankBatch+blanks.
Через ваши сервисы:
issue blanks
create waybill (reserve blank)
SUBMITTED → POSTED
Проверить:
blank RESERVED → USED
stock movement created
audit created
number присвоен (если ваша логика это делает)
Expected result

Любая поломка базового процесса фиксируется тестом.
Tests

Это и есть тест; обязателен в CI.
EPIC REL-600 — Контрактная дисциплина DTO (чтобы не возвращались баги типа “number обязателен”)
[x] REL-601 — Backend: единый слой DTO + коды ошибок
Task
DTO-схемы и ошибки должны быть стабильными и не расходиться.

Files

backend/src/dto/*.ts
backend/src/utils/errors.ts
контроллеры waybill/vehicle/blank
Steps

Для ключевых операций (waybill create/update/status, blank issue/reserve) — единые zod схемы.
Ошибки возвращать в формате { code, message, details, requestId }.
Expected result

UI не ломается от случайных изменений валидации/полей.
Tests

Integration: неверные payload → 400 с code+details.
REL-602 — Frontend: единый обработчик API ошибок (показывать code/requestId)
Task
Чтобы пользователи не видели “Нет данных” вместо 403/500.

Files

frontend/src/services/httpClient.ts
frontend/src/components/ErrorBanner.tsx (new) или ваш toast
Steps

Парсить { code, message, requestId } из ответов.
В UI показывать понятное сообщение + requestId.
Expected result

Ошибки диагностируются без DevTools.
Tests

UI: имитация ошибки возвращает баннер с requestId.
EPIC REL-700 — Доведение до строгости (после миграции UI)
[x] REL-701 — Backend: убрать fallback employeeId→driverId (строгий режим)
Task
После перевода фронта на /drivers убрать поддержку “driverId как employeeId”.

Files

backend/src/services/waybillService.ts
backend/src/services/blankService.ts
DTO
Steps

Удалить fallback.
Все запросы требуют настоящий Driver.id.
Expected result

Доменные API становятся предсказуемыми, исчезает “магия”.
Tests

Integration: передать employeeId как driverId → 400/409.
[x] REL-702 — RBAC cache: инвалидация
Task
Чтобы “права починили, но ещё минуту 403”.

Files

backend/src/middleware/checkPermission.ts
(опционально) backend/src/routes/adminRoutes.ts
Steps

Добавить функцию сброса кэша.
Добавить admin endpoint POST /admin/cache/permissions/clear.
Либо уменьшить TTL в dev режиме.
Expected result

Изменения RBAC применяются сразу.
Tests

Integration: сменили права → сбросили кэш → доступ изменился.
Рекомендуемый порядок выполнения
REL-101 → REL-102 → REL-103
REL-201 → REL-202 → REL-203 → REL-204
REL-301 → REL-302 → REL-303 → REL-304
REL-401 → REL-402
REL-501 → REL-502
REL-601 → REL-602
REL-701 → REL-702
===============================================================================================

EPIC AUTH-000 — Stabilization Refresh + Session UX
AUTH-001 — Backend Integration Tests: refresh rotation + REL-402 revoke
Task
Добавить интеграционные тесты, которые гарантируют: ротация одноразовая, replay/конкурентность не ломает, REL‑402 реально рубит refresh после переноса org/dept.

Files

backend/tests/integration/authRefresh.test.ts (new)
(если нужно) backend/tests/helpers/testApp.ts (new, чтобы поднять express app)
(если нужно) backend/tests/helpers/db.ts (reset/cleanup)
существующие: backend/src/controllers/authController.ts, backend/src/controllers/adminController.ts
Steps

Подготовить тестовую БД (отдельный DATABASE_URL для тестов).
[x] Backend: POST /api/auth/logout-all (tokenVersion++, revoke all refresh, clear cookie)
[x] Frontend: logoutAll() in authApi.ts
[x] Frontend: UX — кнопка в меню заголовка с подтверждением
[x] Frontend: UX — тексты для "Вы выход со всех устройств"
[x] Тест: Logout everywhere в authRefresh.test.ts
Тест “Rotation”:
POST /api/auth/login → сохранить cookies (set-cookie)
POST /api/auth/refresh → успех, cookie обновилась
повторить POST /api/auth/refresh со старой cookie → 401
Тест “Concurrent refresh”:
login → взять cookie
отправить 2 параллельных запроса refresh с одним и тем же cookie
ожидание: один 200, второй 401 (из-за count !== 1)
Тест “REL‑402 transferUser revoke-all”:
login → refresh ok
POST /api/admin/transfer-user (под admin) → сменить org/dept
POST /api/auth/refresh со старой cookie → 401
новый login → access token содержит новый organizationId/departmentId
Expected result

Любая регрессия в refresh/transferUser ловится тестами.
Гарантировано: refresh одноразовый, revoke работает.
Tests

Эти 3 теста и есть критерий. Прогон в CI/локально зелёный.
AUTH-002 — Frontend UX: единый “разлогин по истёкшей сессии/ревоку”
Task
Когда auto-refresh не смог обновить токен (refresh вернул 401), приложение должно корректно разлогинить пользователя и показать понятное сообщение, а не “пустые списки”.

Files

frontend/src/services/httpClient.ts (доработка — точка принятия решения)
frontend/src/services/auth/session.ts (new или существующий модуль)
frontend/src/router.tsx / App.tsx (где делается навигация)
(опционально) frontend/src/components/Toast.tsx или ваш механизм уведомлений
Steps

В httpClient в ветке “refresh не удался”:
очищать access token (у вас уже есть)
вызывать единый хук/функцию onSessionExpired(reason)
Реализовать onSessionExpired:
редирект на /login
показать toast/banner:
“Сессия завершена: доступ изменён администратором или истекла авторизация. Войдите снова.”
Убедиться, что это работает и при:
истечении access token
revoke refresh в REL‑402
logout
Expected result

Пользователь не видит “сломанное приложение”, а получает ясный сценарий.
Tests

UI smoke: искусственно заставить refresh вернуть 401 → пользователь оказывается на /login + сообщение.
AUTH-003 — Backend: tokenVersion для немедленной инвалидации access token (опционально, но рекомендовано)
Task
Сделать так, чтобы после transferUser (смена org/dept) пользователь сразу потерял доступ даже с действующим access token, а не ждал expiry.

Files

backend/prisma/schema.prisma
миграция Prisma
backend/src/utils/jwt.ts (sign/verify)
backend/src/middleware/authMiddleware.ts
backend/src/controllers/adminController.ts (transferUser)
(опционально) backend/src/services/authService.ts
Steps

Prisma: добавить в User поле:
[x] tokenVersion Int @default(0)
[x] При выдаче access token (login/refresh):
включить tokenVersion в claims.
[x] В authMiddleware:
после decode JWT загрузить User.tokenVersion и сравнить с claim
если не совпадает → 401 (Invalid session)
[x] В transferUser (в той же транзакции где revoke refresh):
tokenVersion = tokenVersion + 1
Expected result

Перенос пользователя на другую org/dept разрывает доступ мгновенно.
Исключает “старый access ещё действует”.
Tests

Integration: login → access ok → transferUser → следующий запрос с тем же access → 401.
Integration: refresh после transferUser уже 401 (у вас есть), login выдаёт новый access → 200.
AUTH-004 — Backend/Frontend: проверка cookie path/secure + CORS credentials (hardening)
Task
Зафиксировать настройки cookie и CORS так, чтобы:

в dev работало на http://localhost
в prod было безопасно
cookie реально отправлялась на /api/auth/refresh
Files

backend/src/utils/refreshToken.ts (getRefreshCookieOptions)
backend/src/app.ts (cors middleware)
frontend/src/services/httpClient.ts (credentials include уже есть)
Steps

secure делать окруженчески: secure: NODE_ENV === 'production'.
path согласовать с вашим mount:
если у вас /api/auth/refresh, лучше path: '/api/auth/refresh'
либо path: '/api/auth' (чуть шире, но безопасно)
Logout должен делать clearCookie с теми же options.
Если фронт/бэк на разных origin:
backend CORS: credentials: true, origin: конкретный
фронт: credentials: 'include' уже есть
Expected result

Refresh cookie стабильно работает в браузере dev/prod.
Нет “работает в curl, но не работает в UI”.
Tests

Manual browser test: login → в DevTools видно cookie → refresh проходит.
Integration (опционально): проверка Set-Cookie атрибутов в ответе login/refresh.
Порядок выполнения
[x] AUTH-001 (тесты — сразу поймают любые регрессии)
[x] AUTH-002 (UX разлогина — прекратит “пусто/сломалось”)
[x] AUTH-003 (tokenVersion мгновенный доступ)
[x] AUTH-004 (hardening cookie/cors)
[x] AUTH-004.1 (logout everywhere)

### AUTH-004.1 — Logout Everywhere
[x] Backend: POST /api/auth/logout-all (tokenVersion++, revoke all refresh, clear cookie)
[x] Frontend: logoutAll() in authApi.ts
[x] Frontend: UX — кнопка в меню заголовка с подтверждением
[x] Frontend: UX — тексты для "Выход со всех устройств" в session.ts
[x] Тест: Logout everywhere в authRefresh.test.ts