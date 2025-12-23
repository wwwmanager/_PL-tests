# Waybill Management System - Backend

Backend API для системы управления путевыми листами, построенный на Express.js + Prisma + PostgreSQL.

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd backend
npm install
```

### 2. Настройка окружения

Создайте файл `.env` на основе `.env.example`:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/waybills?schema=public"
PORT=3001
JWT_SECRET="your_strong_secret_here_change_in_production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
NODE_ENV="development"
```

> **Примечание:** Frontend обычно запускается на порту 3000 с прокси на backend (3001).

### 3. Настройка базы данных

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Запуск сервера

**Режим разработки** (с hot-reload):
```bash
npm run dev
```

**Production build**:
```bash
npm run build
npm start
```

## 🏗️ Структура проекта

```
backend/
├── src/
│   ├── app.ts               # Express приложение
│   ├── server.ts            # Точка входа
│   ├── config/
│   │   └── env.ts           # Переменные окружения
│   ├── db/
│   │   └── prisma.ts        # Prisma Client
│   ├── dto/                 # Zod-схемы валидации
│   │   ├── waybillDto.ts
│   │   ├── vehicleDto.ts
│   │   ├── employeeDto.ts
│   │   ├── driverDto.ts
│   │   └── stockMovementDto.ts
│   ├── jobs/                # Фоновые задачи
│   │   ├── fuelCardTopUpJob.ts  # Автопополнение карт
│   │   ├── scheduler.ts
│   │   └── locks.ts
│   ├── middleware/
│   │   ├── authMiddleware.ts
│   │   ├── validateDto.ts   # Zod-валидация
│   │   ├── checkPermission.ts
│   │   └── errorMiddleware.ts
│   ├── routes/              # 24 файла роутов
│   │   ├── index.ts
│   │   ├── waybillRoutes.ts
│   │   ├── stockRoutes.ts
│   │   ├── stockLocationRoutes.ts
│   │   ├── fuelCardRoutes.ts
│   │   ├── adminRoutes.ts
│   │   └── ...
│   ├── controllers/         # 26+ контроллеров
│   │   ├── waybillController.ts
│   │   ├── stockController.ts
│   │   ├── stockBalanceController.ts
│   │   └── ...
│   ├── services/
│   └── utils/
│       ├── jwt.ts
│       ├── password.ts
│       ├── topUpUtils.ts
│       └── errors.ts
├── prisma/
│   └── schema.prisma
└── package.json
```

## � API Endpoints

### Аутентификация

- `POST /api/auth/login` - Вход в систему
  - Body: `{ email: string, password: string }`
  - Response: `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh` - Обновить токен
- `POST /api/auth/logout` - Выход

### Путевые листы (Waybills)

- `GET /api/waybills` - Список путевых листов
  - Query: `?startDate=...&endDate=...&vehicleId=...&driverId=...&status=...`
- `GET /api/waybills/prefill/:vehicleId` - Предзаполнение данных для нового ПЛ
- `POST /api/waybills` - Создать путевой лист
- `GET /api/waybills/:id` - Получить путевой лист
- `PUT /api/waybills/:id` - Обновить путевой лист
- `DELETE /api/waybills/:id` - Удалить путевой лист
- `PATCH /api/waybills/:id/status` - Изменить статус
  - Body: `{ status: "DRAFT" | "SUBMITTED" | "POSTED" | "CANCELLED" }`

**Жизненный цикл статусов:**
```
DRAFT → SUBMITTED → POSTED
          ↓
      CANCELLED
```

### Транспортные средства

- `GET /api/vehicles` - Список ТС
- `POST /api/vehicles` - Создать ТС
- `GET /api/vehicles/:id` - Получить ТС
- `PUT /api/vehicles/:id` - Обновить ТС
- `DELETE /api/vehicles/:id` - Удалить ТС

### Водители

- `GET /api/drivers` - Список водителей
- `POST /api/drivers` - Создать водителя
- `GET /api/drivers/:id` - Получить водителя
- `PUT /api/drivers/:id` - Обновить водителя
- `DELETE /api/drivers/:id` - Удалить водителя

### Складской учёт (Stock)

#### Балансы

- `GET /api/stock/balances` - Балансы всех локаций
  - Query: `?stockItemId=...&asOf=...`
- `GET /api/stock/balance` - Баланс одной локации
  - Query: `?locationId=...&stockItemId=...&asOf=...`

#### Локации хранения

- `GET /api/stock/locations` - Список локаций
- `GET /api/stock/locations/:id` - Локация по ID
- `POST /api/stock/locations/warehouse` - Получить/создать локацию склада
- `POST /api/stock/locations/vehicle-tank` - Получить/создать локацию бака ТС
- `POST /api/stock/locations/fuel-card` - Получить/создать локацию топливной карты

#### Движения v2 (Stock Movements)

- `GET /api/stock/movements/v2` - Список движений
  - Query params:
    - `from` / `occurredFrom` — ISO дата начала (>=)
    - `to` / `occurredTo` — ISO дата конца (<=)
    - `movementType` — `INCOME` | `EXPENSE` | `ADJUSTMENT` | `TRANSFER`
    - `stockItemId` — UUID товара
    - `locationId` — UUID локации (ищет по stockLocationId, fromStockLocationId, toStockLocationId)
    - `page` — номер страницы (default: 1)
    - `pageSize` — размер страницы (default: 50, max: 200)
  - Response: `{ success: true, data: [...], total, page, pageSize }`
  - Errors: 400 на невалидные даты или movementType

- `POST /api/stock/movements/v2` - Создать движение
  - Body для **INCOME/EXPENSE/ADJUSTMENT**:
    ```json
    {
      "movementType": "INCOME",
      "stockItemId": "uuid",
      "quantity": "100.5",
      "stockLocationId": "uuid",
      "occurredAt": "2024-12-23T10:00:00Z",
      "comment": "string"
    }
    ```
  - Body для **TRANSFER**:
    ```json
    {
      "movementType": "TRANSFER",
      "stockItemId": "uuid",
      "quantity": "50",
      "fromLocationId": "uuid",
      "toLocationId": "uuid",
      "occurredAt": "2024-12-23T10:00:00Z",
      "externalRef": "MANUAL_TOPUP:uuid",
      "comment": "string"
    }
    ```
  - `externalRef` — для идемпотентности (уникален в пределах организации)
  - `occurredAt` — когда произошло движение (default: now)
  - `occurredSeq` — порядок в пределах одного occurredAt

### Топливные карты (Fuel Cards)

#### CRUD

- `GET /api/fuel-cards` - Список карт
- `POST /api/fuel-cards` - Создать карту
- `PUT /api/fuel-cards/:id` - Обновить карту
- `DELETE /api/fuel-cards/:id` - Удалить карту

#### Назначения (Assignments)

- `GET /api/fuel-cards/:cardId/assignments` - История назначений карты
- `POST /api/fuel-cards/:cardId/assignments` - Назначить карту водителю/ТС

#### Пополнение топливных карт

**Ручное пополнение (Manual TopUp):**
1. Получить/создать локацию карты: `POST /api/stock/locations/fuel-card` с `{ fuelCardId }`
2. Создать TRANSFER: `POST /api/stock/movements/v2` с `fromLocationId` (склад) → `toLocationId` (карта)

**Автоматическое пополнение (Auto TopUp):**
- Endpoint: `POST /api/admin/jobs/run-fuelcard-topups` (требует роль admin)
- Модель правил: `FuelCardTopUpRule`
- Job: `jobs/fuelCardTopUpJob.ts`
- Использует `externalRef` для идемпотентности: `TOPUP:ruleId:date`

> **Важно:** Баланс карты рассчитывается из ledger (сумма движений). Поле `balanceLiters` в FuelCard может быть кешем или устарело.

### Административные функции

- `GET /api/admin/data-preview` - Превью данных по категориям
- `POST /api/admin/selective-delete` - Выборочное удаление
- `POST /api/admin/import` - Импорт JSON
- `DELETE /api/admin/reset-database` - Сброс базы (⚠️)
- `POST /api/admin/transfer-user` - Перенос пользователя между организациями
- `POST /api/admin/recalculate` - Пересчёт балансов
- `POST /api/admin/jobs/run-fuelcard-topups` - Ручной запуск job автопополнения

### Служебные

- `GET /api/health` - Health check
- `GET /api/me` - Текущий пользователь

## 🔐 Аутентификация

Все эндпоинты кроме `/api/auth/login`, `/api/auth/refresh` и `/api/health` требуют JWT токен:

```
Authorization: Bearer <token>
```

## 🗄️ База данных

### Основные модели

- **Organization** - Организации
- **User** - Пользователи системы
- **Employee** - Сотрудники
- **Driver** - Водители
- **Vehicle** - Транспортные средства
- **Waybill** - Путевые листы
- **StockItem** - Номенклатура (топливо, ТМЦ)
- **StockLocation** - Локации хранения (склад, бак ТС, топливная карта)
- **StockMovement** - Движения товаров
- **FuelCard** - Топливные карты
- **FuelCardTopUpRule** - Правила автопополнения

### Миграции

```bash
# Создать новую миграцию
npx prisma migrate dev --name migration_name

# Применить миграции
npx prisma migrate deploy

# Сбросить базу (⚠️ удалит все данные)
npx prisma migrate reset

# Открыть Prisma Studio
npx prisma studio
```

## �️ Тестирование

```bash
# Unit/integration тесты (Vitest)
npm test

# E2E тесты
npm run test:e2e
```

## 🤝 Интеграция с фронтендом

1. Frontend запускается на `http://localhost:3000`
2. Backend запускается на `http://localhost:3001`
3. Frontend использует прокси `/api → http://localhost:3001/api`
4. JWT токен хранится в localStorage и отправляется с каждым запросом
