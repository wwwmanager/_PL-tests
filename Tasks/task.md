Backlog (Jira‑style)
WB-1001 — Prisma: добавить FuelCalculationMethod на Waybill
Task
Добавить поле метода расчёта planned на уровне ПЛ, с дефолтом “котловой”.

Files

backend/prisma/schema.prisma
миграция Prisma
Steps

Добавить enum:
FuelCalculationMethod { BOILER MIXED SEGMENTS }
Добавить в Waybill:
fuelCalculationMethod FuelCalculationMethod @default(BOILER)
Применить миграцию.
Expected result

У каждого ПЛ в БД хранится выбранный метод, по умолчанию BOILER.
Tests

Smoke: миграция применяется, Prisma client генерируется.
WB-1002 — Prisma: флаги city/warming на уровне сегментов маршрута
Task
Поддержать city/warming “по строкам маршрута”.

Files

backend/prisma/schema.prisma
миграция Prisma
Steps

В WaybillRoute добавить:
isCityDriving Boolean?
isWarming Boolean?
Применить миграцию.
Expected result

Маршрутные строки могут хранить условия движения для точного/смешанного методов.
Tests

Smoke: миграция + простой create/update WaybillRoute.
WB-1003 — Backend domain: реализовать 3 метода расчёта planned
Task
Расширить доменный модуль расчёта топлива: BOILER, SEGMENTS, MIXED.

Files

backend/src/domain/waybill/fuel.ts (доработка)
(если нужно) backend/src/domain/waybill/types.ts (новый, для типов сегментов)
Steps

Добавить тип:
FuelCalculationMethod = 'BOILER'|'MIXED'|'SEGMENTS'
Добавить функцию:
calculatePlannedFuelByMethod({ method, baseRate, odometerDistanceKm?, segments?, cityK, warmK })
Реализовать:
BOILER: odometerDistanceKm обязателен
SEGMENTS: segments обязателен, rounding per segment
MIXED: segments + odometerDistanceKm обязателен, avgRate как описано выше
Везде вернуть round2(planned).
Expected result

Единая серверная функция выдаёт planned по выбранному методу.
Tests

Unit:
BOILER: 50км при rate=10 → 5.00
SEGMENTS: 2 сегмента с разными флагами → сумма округлённых сегментов
MIXED: avgRate из сегментов → применение к odometerDistance
WB-1004 — Backend: принять/сохранять routes в create/update Waybill
Task
Сейчас createWaybill не создаёт WaybillRoute. Для методов 1/2 нужно сохранять маршруты.

Files

backend/src/controllers/waybillController.ts
backend/src/services/waybillService.ts
Steps

Расширить DTO (валидацию) на routes?: Array<{ legOrder, fromPoint, toPoint, distanceKm, isCityDriving?, isWarming? }>
В createWaybill добавить nested create routes.
В updateWaybill сделать replace маршрутов (аналогично fuelLines):
deleteMany({ waybillId }) + create(...) отсортировано по legOrder.
Expected result

Маршруты ПЛ сохраняются и доступны для расчёта.
Tests

Integration: create with routes → routes созданы, порядок сохранён.
Integration: update routes → старые удалены, новые созданы.
WB-1005 — WaybillService: считать fuelPlanned по выбранному методу
Task
Переключить расчёт fuelPlanned на метод fuelCalculationMethod.

Files

backend/src/services/waybillService.ts
backend/src/services/settingsService.ts
backend/src/utils/dateUtils.ts
backend/src/domain/waybill/fuel.ts
Steps

В create/update:
определить baseRate по season_settings и vehicle.fuelConsumptionRates
определить method = input.fuelCalculationMethod ?? BOILER
Для BOILER/MIXED:
вычислить odometerDistanceKm, валидировать odometerEnd >= odometerStart
Для SEGMENTS/MIXED:
собрать segments из input.routes (или из сохранённых routes при update)
валидировать: есть сегменты с distanceKm > 0
Посчитать planned через доменную функцию и записать в WaybillFuel.fuelPlanned для “топливной” строки.
Expected result

Planned считается корректно по методу; BOILER используется по умолчанию.
Tests

Integration: create BOILER → planned посчитан, маршруты не нужны.
Integration: create SEGMENTS без routes → 400 (или 409) с понятной ошибкой.
Integration: create MIXED без odometer → 400.
WB-1006 — Backend: ошибки валидации метода (чёткие коды)
Task
Дать фронту предсказуемые ошибки, чтобы красиво показывать пользователю.

Files

backend/src/utils/errors.ts
backend/src/controllers/waybillController.ts (маппинг)
backend/src/services/waybillService.ts
Steps

Ввести коды ошибок:
ROUTES_REQUIRED_FOR_METHOD
ODOMETER_REQUIRED_FOR_METHOD
INVALID_ROUTE_DISTANCE
Возвращать 400 с details.method.
Expected result

UI получает структурированную ошибку и может подсветить нужный блок формы.
Tests

Integration: SEGMENTS без routes → {code:'ROUTES_REQUIRED_FOR_METHOD'}.
FE-1001 — Frontend: селектор “Метод расчёта” в форме ПЛ (default = Котловой)
Task
Добавить выбор метода в UI формы ПЛ; по умолчанию BOILER.

Files

frontend/src/pages/WaybillDetail.tsx (или ваш экран формы)
frontend/src/types.ts
frontend/src/services/api/waybillApi.ts (DTO)
Steps

Добавить enum/union на фронте:
BOILER | MIXED | SEGMENTS
В форме добавить select:
“Котловой (базовый)” (default)
“По общему (смешанный)”
“По отрезкам (точный)”
Отправлять fuelCalculationMethod в create/update.
Expected result

Пользователь выбирает метод прямо в форме, дефолт — котловой.
Tests

UI smoke: переключение метода не ломает форму, payload содержит поле.
FE-1002 — Frontend: флаги city/warming на строках маршрута
Task
Для методов SEGMENTS/MIXED дать возможность отмечать город/прогрев по каждому сегменту.

Files

компонент маршрута (WaybillRoute block) в WaybillDetail.tsx или отдельный компонент
Steps

В каждой строке маршрута добавить чекбоксы:
“Город”
“Прогрев”
Сохранять эти поля в routes[i].isCityDriving/isWarming.
Для BOILER можно скрыть/disable (не участвуют).
Expected result

Условия поездок задаются на уровне сегмента и уезжают на backend.
Tests

UI: переключение метода показывает/скрывает поля.
Payload: routes включают флаги.
FE-1003 — Frontend: отображение рассчитанного planned с backend + подсказки
Task
Показывать fuelPlanned, который вернул backend, и предупреждения по методу.

Files

WaybillDetail.tsx / FuelBlock
Steps

После сохранения/создания показывать fuelPlanned из ответа (WaybillFuel.fuelPlanned).
Если метод SEGMENTS/MIXED и routes пустые — показывать предупреждение до отправки.
Обрабатывать ошибки кодов из WB-1006 и подсвечивать блок маршрута/одометра.
Expected result

Пользователь видит серверный planned и понимает, что надо заполнить.
Tests

UI: красивое сообщение при 400 ROUTES_REQUIRED_FOR_METHOD.
WB-1007 — Тесты: покрыть методы (unit + integration)
Task
Зафиксировать поведение расчётов и валидаций тестами.

Files

Unit: backend/src/domain/waybill/fuel.test.ts
Integration: backend/src/services/waybillService.int.test.ts или route tests
Steps

Unit: 3 метода + rounding.
Integration: create/update для каждого метода:
BOILER: только odometer
SEGMENTS: только routes
MIXED: routes + odometer
Проверить, что planned сохраняется только в “топливной” строке.
Expected result

Регрессии по расчётам ловятся автоматически.
Tests

Это и есть тестовый тикет.
Рекомендуемый порядок выполнения
WB-1001 → WB-1002 → WB-1003 (модель + домен)
WB-1004 → WB-1005 → WB-1006 (интеграция в сервис/контроллер)
FE-1001 → FE-1002 → FE-1003 (UI)
WB-1007 (тесты)
