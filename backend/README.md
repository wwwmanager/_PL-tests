# Waybill Management System - Backend

Backend API для системы управления путевыми листами, построенный на Express.js + Prisma + PostgreSQL.

## 🏗️ Структура проекта

```
backend/
├── src/
│   ├── app.ts               # Express приложение
│   ├── server.ts            # Точка входа (запуск сервера)
│   ├── config/
│   │   └── env.ts           # Конфигурация переменных окружения
│   ├── db/
│   │   └── prisma.ts        # Prisma Client
│   ├── middleware/
│   │   ├── authMiddleware.ts    # JWT аутентификация
│   │   └── errorMiddleware.ts   # Обработка ошибок
│   ├── routes/
│   │   ├── index.ts
│   │   ├── authRoutes.ts
│   │   ├── vehicleRoutes.ts
│   │   ├── driverRoutes.ts
│   │   └── waybillRoutes.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── vehicleController.ts
│   │   ├── driverController.ts
│   │   └── waybillController.ts
│   ├── services/
│   │   ├── authService.ts
│   │   ├── vehicleService.ts
│   │   ├── driverService.ts
│   │   └── waybillService.ts
│   └── utils/
│       ├── jwt.ts
│       ├── password.ts
│       └── errors.ts
├── prisma/
│   └── schema.prisma
└── package.json
```

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd backend
npm install
```

### 2. Настройка окружения

Создайте файл `.env` на основе `.env.template`:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/waybills?schema=public"
PORT=3000
JWT_SECRET="your_strong_secret_here_change_in_production"
JWT_EXPIRES_IN="15m"
NODE_ENV="development"
```

### 3. Настройка базы данных

Убедитесь, что PostgreSQL запущен, затем выполните миграции:

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

## 📚 API Endpoints

### Аутентификация

- `POST /api/auth/login` - Вход в систему
  - Body: `{ email: string, password: string }`
  - Response: `{ accessToken: string, user: {...} }`

### Транспортные средства

- `GET /api/vehicles` - Список ТС
- `POST /api/vehicles` - Создать ТС
- `GET /api/vehicles/:id` - Получить ТС по ID
- `PUT /api/vehicles/:id` - Обновить ТС
- `DELETE /api/vehicles/:id` - Удалить ТС

### Водители

- `GET /api/drivers` - Список водителей
- `POST /api/drivers` - Создать водителя
- `GET /api/drivers/:id` - Получить водителя по ID
- `PUT /api/drivers/:id` - Обновить водителя
- `DELETE /api/drivers/:id` - Удалить водителя

### Путевые листы

- `GET /api/waybills` - Список путевых листов
  - Query params: `?startDate=...&endDate=...&vehicleId=...&driverId=...&status=...`
- `POST /api/waybills` - Создать путевой лист
- `GET /api/waybills/:id` - Получить путевой лист по ID
- `PUT /api/waybills/:id` - Обновить путевой лист
- `DELETE /api/waybills/:id` - Удалить путевой лист
- `PATCH /api/waybills/:id/status` - Изменить статус
  - Body: `{ status: "DRAFT" | "APPROVED" | "ISSUED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }`

### Складской учёт (Stock)

- `GET /api/stock/balances` - Балансы всех локаций
  - Query params: `?stockItemId=...&asOf=...`
- `GET /api/stock/balance` - Баланс одной локации
  - Query params: `?locationId=...&stockItemId=...&asOf=...`

#### Движения v2 (STOCK-MOVEMENTS-V2-GET)

- `GET /api/stock/movements/v2` - Список движений с фильтрацией и пагинацией
  - Query params:
    - `from` / `occurredFrom` — ISO дата начала периода (>=)
    - `to` / `occurredTo` — ISO дата конца периода (<=)
    - `movementType` — `INCOME` | `EXPENSE` | `ADJUSTMENT` | `TRANSFER`
    - `stockItemId` — UUID товара
    - `locationId` — UUID локации (ищет по любому полю: stockLocationId, fromStockLocationId, toStockLocationId)
    - `page` — номер страницы (default: 1)
    - `pageSize` — размер страницы (default: 50, max: 200)
  - Response: `{ success: true, data: [...], total: number, page: number, pageSize: number }`
  - Errors: 400 на невалидные даты или movementType

- `POST /api/stock/movements/v2` - Создать движение
  - Body: `{ movementType, stockItemId, quantity, stockLocationId?, fromLocationId?, toLocationId?, occurredAt?, comment? }`

### Служебные

- `GET /api/health` - Health check

## 🔐 Аутентификация

Все эндпоинты кроме `/api/auth/login` и `/api/health` требуют JWT токен в заголовке:

```
Authorization: Bearer <token>
```

## 🗄️ База данных

### Модели

- **Organization** - Организации
- **User** - Пользователи системы
- **Employee** - Сотрудники
- **Driver** - Водители (связаны с Employee)
- **Vehicle** - Транспортные средства
- **Waybill** - Путевые листы

### Миграции

Создать новую миграцию:
```bash
npx prisma migrate dev --name migration_name
```

Применить миграции:
```bash
npx prisma migrate deploy
```

Сбросить базу (⚠️ удалит все данные):
```bash
npx prisma migrate reset
```

## 🛠️ Полезные команды

```bash
# Открыть Prisma Studio (GUI для базы данных)
npx prisma studio

# Форматировать schema.prisma
npx prisma format

# Проверить статус миграций
npx prisma migrate status
```

## 📝 Следующие шаги

Это минимальная версия backend. Планируется добавить:

- [ ] Регистрацию пользователей
- [ ] Role-based access control (RBAC)
- [ ] Refresh tokens
- [ ] Валидация входных данных (express-validator / zod)
- [ ] Rate limiting
- [ ] Логирование (winston)
- [ ] State machine для путевых листов
- [ ] Работу со складом, бланками, топливными картами
- [ ] Audit log
- [ ] Тесты (jest)
- [ ] Docker setup
- [ ] CI/CD

## 🤝 Интеграция с фронтендом

Чтобы фронтенд мог подключиться к backend:

1. Укажите в `.env` фронтенда:
   ```
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

2. Убедитесь, что CORS настроен корректно (по умолчанию разрешены все источники)

3. JWT токен сохраняется в localStorage фронтенда и отправляется с каждым запросом
