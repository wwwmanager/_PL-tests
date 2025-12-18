# 🏗️ Backend Architecture Overview

## Структура проекта

```
backend/
├── src/
│   ├── app.ts                    # Express app configuration
│   ├── server.ts                 # Server entry point
│   ├── config/
│   │   └── env.ts                # Environment variables management
│   ├── db/
│   │   └── prisma.ts             # Prisma Client instance
│   ├── middleware/
│   │   ├── authMiddleware.ts     # JWT authentication
│   │   └── errorMiddleware.ts    # Global error handler
│   ├── routes/
│   │   ├── index.ts              # Routes aggregator
│   │   ├── authRoutes.ts         # /api/auth/*
│   │   ├── vehicleRoutes.ts      # /api/vehicles/*
│   │   ├── driverRoutes.ts       # /api/drivers/*
│   │   └── waybillRoutes.ts      # /api/waybills/*
│   ├── controllers/
│   │   ├── authController.ts     # Auth request handlers
│   │   ├── vehicleController.ts  # Vehicle request handlers
│   │   ├── driverController.ts   # Driver request handlers
│   │   └── waybillController.ts  # Waybill request handlers
│   ├── services/
│   │   ├── authService.ts        # Auth business logic
│   │   ├── vehicleService.ts     # Vehicle business logic
│   │   ├── driverService.ts      # Driver business logic
│   │   └── waybillService.ts     # Waybill business logic
│   └── utils/
│       ├── jwt.ts                # JWT token utilities
│       ├── password.ts           # Password hashing
│       └── errors.ts             # Custom error classes
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.ts                   # Database seeding script
├── .env                          # Environment variables (gitignored)
├── .env.template                 # Environment template
├── package.json
├── tsconfig.json
├── README.md
└── QUICKSTART.md

**Создано файлов:** ~30
**Строк кода:** ~1500+
```

## Архитектурные принципы

### 1. **Layered Architecture** (Слоистая архитектура)

```
┌─────────────────────────────────────┐
│         Routes Layer                │  ← HTTP маршруты
├─────────────────────────────────────┤
│      Controllers Layer              │  ← Обработка запросов/ответов
├─────────────────────────────────────┤
│       Services Layer                │  ← Бизнес-логика
├─────────────────────────────────────┤
│     Data Access Layer (Prisma)      │  ← Работа с БД
└─────────────────────────────────────┘
```

**Преимущества:**
- ✅ Разделение ответственности
- ✅ Легкое тестирование каждого слоя
- ✅ Простота поддержки и расширения

### 2. **Dependency Injection**

Сервисы изолированы и могут быть легко заменены для тестирования.

### 3. **Security First**

- 🔐 JWT authentication
- 🔑 Bcrypt password hashing
- 🛡️ Organization-scoped data access
- ✨ CORS protection

### 4. **Type Safety**

- TypeScript на всех уровнях
- Prisma автоматически генерирует типы
- Строгая типизация входных/выходных данных

## Data Flow

### Пример: Создание путевого листа

```
1. [Request]
   POST /api/waybills
   Headers: Authorization: Bearer <token>
   Body: { number, date, vehicleId, driverId, ... }
   
2. [Middleware] authMiddleware
   ✓ Проверка JWT токена
   ✓ Извлечение user.organizationId
   ✓ Добавление req.user
   
3. [Route] waybillRoutes
   ✓ Маршрут POST / → waybillController.createWaybill
   
4. [Controller] waybillController.createWaybill
   ✓ Извлечение данных из req.body
   ✓ Вызов waybillService.createWaybill(orgId, data)
   ✓ Возврат ответа res.status(201).json(waybill)
   
5. [Service] waybillService.createWaybill
   ✓ Валидация данных
   ✓ Проверка: vehicle принадлежит организации
   ✓ Проверка: driver принадлежит организации
   ✓ Создание записи через Prisma
   
6. [Prisma] Database Access
   ✓ SQL-запрос к PostgreSQL
   ✓ Возврат созданной записи
   
7. [Response]
   Status: 201 Created
   Body: { id, number, date, vehicle: {...}, driver: {...}, ... }
```

### Обработка ошибок

```
[Anywhere] throw new BadRequestError("Некорректная дата")
     ↓
[Middleware] errorMiddleware
     ↓
[Response] { error: "Некорректная дата", code: "BAD_REQUEST" }
     status: 400
```

## Database Schema

### Core Models

```
Organization
  ├─ 1:N → Users
  ├─ 1:N → Employees
  ├─ 1:N → Vehicles
  └─ 1:N → Waybills

Employee
  └─ 1:1? → Driver

Waybill
  ├─ N:1 → Organization
  ├─ N:1 → Vehicle
  └─ N:1 → Driver
```

### Waybill Status Flow

```
DRAFT → APPROVED → ISSUED → IN_PROGRESS → COMPLETED
                                ↓
                           CANCELLED
```

## Authentication & Authorization

### JWT Token Structure

```json
{
  "sub": "user-id",
  "organizationId": "org-id",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Authorization Pattern

Все сервисы принимают `organizationId` первым параметром:

```typescript
async function listWaybills(organizationId: string, filters?: {...})
```

Это гарантирует, что пользователь видит только данные своей организации.

## Security Features

### 1. Organization Isolation
Каждый запрос фильтруется по `organizationId` из JWT токена.

### 2. Password Security
- Bcrypt с salt rounds = 10
- Пароли никогда не возвращаются в API responses

### 3. Input Validation
Все даты, ID и статусы проверяются перед записью в БД.

### 4. Error Handling
- Общие ошибки не раскрывают внутреннюю структуру
- Детальные логи только на сервере

## Environment Configuration

Все чувствительные данные в `.env`:
- `DATABASE_URL` - connection string
- `JWT_SECRET` - секретный ключ для JWT
- `JWT_EXPIRES_IN` - время жизни токена
- `PORT` - порт сервера
- `NODE_ENV` - окружение (development/production)

## API Design Principles

### 1. RESTful Conventions
- `GET /resources` - список
- `POST /resources` - создание
- `GET /resources/:id` - получение по ID
- `PUT /resources/:id` - полное обновление
- `PATCH /resources/:id/action` - частичное обновление/действие
- `DELETE /resources/:id` - удаление

### 2. Consistent Response Format

**Success:**
```json
{
  "id": "...",
  "field1": "...",
  ...
}
```

**Error:**
```json
{
  "error": "Описание ошибки",
  "code": "ERROR_CODE"
}
```

### 3. HTTP Status Codes
- `200` - OK (успешное получение/обновление)
- `201` - Created (успешное создание)
- `400` - Bad Request (невалидные данные)
- `401` - Unauthorized (нет токена/невалидный токен)
- `403` - Forbidden (нет прав)
- `404` - Not Found (ресурс не найден)
- `500` - Internal Server Error

## Performance Considerations

### 1. Database Queries
- Используем `include` для загрузки связанных данных одним запросом
- Индексы на: email (User), organizationId (везде), unique constraints

### 2. Connection Pooling
Prisma автоматически управляет пулом соединений.

### 3. Query Optimization
```typescript
// ❌ BAD: N+1 query problem
const waybills = await prisma.waybill.findMany();
for (const wb of waybills) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: wb.vehicleId } });
}

// ✅ GOOD: Single query with includes
const waybills = await prisma.waybill.findMany({
  include: { vehicle: true, driver: { include: { employee: true } } }
});
```

## Testing Strategy (Future)

```
Unit Tests
  ├─ Services (бизнес-логика)
  └─ Utils (JWT, password, errors)

Integration Tests
  ├─ Controllers + Services
  └─ Full API endpoints

E2E Tests
  └─ Реальные HTTP запросы к API
```

## Deployment Checklist

- [ ] Установить `NODE_ENV=production`
- [ ] Сгенерировать сильный `JWT_SECRET`
- [ ] Настроить реальный PostgreSQL
- [ ] Применить миграции: `npx prisma migrate deploy`
- [ ] Собрать production build: `npm run build`
- [ ] Настроить CORS для production URL
- [ ] Настроить reverse proxy (nginx)
- [ ] Настроить SSL/TLS
- [ ] Настроить логирование
- [ ] Настроить мониторинг

## Roadmap

### Phase 2 (Ближайшие задачи)
- [ ] Validation middleware (express-validator / zod)
- [ ] Refresh tokens
- [ ] Role-based permissions
- [ ] Organization routes (CRUD organizations)

### Phase 3 (Расширенные функции)
- [ ] Модели: Stock, FuelCard, Blank
- [ ] Waybill state machine с валидацией переходов
- [ ] Audit log для всех изменений
- [ ] Файловые вложения (фото путевых листов)

### Phase 4 (Production ready)
- [ ] Comprehensive test coverage
- [ ] Rate limiting
- [ ] Request logging (morgan/winston)
- [ ] Health check с DB status
- [ ] Graceful shutdown
- [ ] Docker + docker-compose
- [ ] CI/CD pipeline

## 📚 Дополнительная документация

- [README.md](./README.md) - Общий обзор
- [QUICKSTART.md](./QUICKSTART.md) - Быстрый старт
- [prisma/schema.prisma](./prisma/schema.prisma) - Схема БД

## 🎯 Итого

✅ **Готовый минимальный backend** для системы путевых листов  
✅ **Чистая архитектура** с разделением слоёв  
✅ **Type-safe** благодаря TypeScript + Prisma  
✅ **Secure** с JWT + bcrypt + organization isolation  
✅ **Ready to extend** для добавления новых функций  

**Время разработки:** ~2-3 часа  
**Строк кода:** ~1500  
**Technologies:** Express.js, Prisma, PostgreSQL, TypeScript, JWT, Bcrypt
