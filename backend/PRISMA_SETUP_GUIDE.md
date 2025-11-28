# Быстрый старт: Расширенная Prisma схема

Пошаговая инструкция по развёртыванию новой схемы базы данных.

## Предварительные требования

- ✅ **PostgreSQL 13+** установлен и запущен
- ✅ **Node.js 18+** и npm
- ✅ **Git** (опционально)

## Шаг 1: Проверка окружения

### 1.1. Проверить PostgreSQL

```bash
# Windows (PowerShell)
psql --version

# Должно показать: psql (PostgreSQL) 13.x или выше
```

```bash
# Подключиться к PostgreSQL
psql -U postgres

# В psql:
CREATE DATABASE waybills;
\q
```

### 1.2. Создать .env файл

```bash
cd C:\_PL-tests\backend
```

Создать файл `.env` (если ещё нет):

```env
# Database
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/waybills?schema=public"

# JWT Secrets
JWT_SECRET="your-super-secret-jwt-key-change-me-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-me"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Server
PORT=3001
NODE_ENV=development

# CORS
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
```

> ⚠️ **Важно:** Замените `your_password` на реальный пароль PostgreSQL

## Шаг 2: Установка зависимостей

```bash
npm install
```

Если нужно обновить Prisma:

```bash
npm install prisma@latest @prisma/client@latest --save-dev
```

## Шаг 3: Применение схемы

### 3.1. Создать миграцию

```bash
npm run prisma:migrate dev --name enhanced_schema
```

**Что происходит:**
1. Prisma читает `schema.prisma`
2. Генерирует SQL миграцию
3. Применяет её к БД
4. Генерирует Prisma Client

**Ожидаемый вывод:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "waybills", schema "public" at "localhost:5432"

Applying migration `20251128_enhanced_schema`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20251128_enhanced_schema/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (5.22.0) to .\node_modules\@prisma\client
```

### 3.2. Проверка таблиц

Подключиться к БД:

```bash
psql -U postgres -d waybills
```

```sql
-- Показать все таблицы
\dt

-- Должно быть 23 таблицы:
-- organizations, departments
-- users, roles, permissions, role_permissions, user_roles
-- employees, drivers
-- vehicles, fuel_cards
-- stock_items, warehouses, stock_movements
-- blank_batches, blanks
-- waybills, waybill_routes, waybill_fuel
-- audit_log, refresh_tokens
-- _prisma_migrations

\q
```

## Шаг 4: Заполнение тестовыми данными

```bash
npm run prisma:seed
```

**Что создаётся:**
- 8 ролей (admin, dispatcher, mechanic, driver, reviewer, accountant, auditor, viewer)
- 36 прав доступа
- 1 организация "ООО Тестовая Транспортная Компания"
- 2 подразделения
- 3 пользователя (admin, dispatcher, mechanic)
- 3 водителя
- 3 транспортных средства
- 2 топливные карты
- 2 склада
- 4 номенклатуры (дизель, АИ-92, АИ-95, масло)
- 100 бланков (серия ЧБ, номера 1-100)
- 2 путевых листа

**Ожидаемый вывод:**
```
🌱 Starting seed...
Creating roles...
Creating permissions...
Mapping role permissions...
Creating organization...
Creating departments...
Creating users...
Creating employees and drivers...
Creating vehicles...
Creating fuel cards...
Creating warehouses...
Creating stock items...
Creating blank batches and blanks...
Creating waybills...
Creating audit log entries...
✅ Seed completed successfully!

📊 Created:
   - 8 roles
   - 36 permissions
   - 1 organization
   - 2 departments
   - 3 users (admin, dispatcher, mechanic)
   - 3 drivers
   - 3 vehicles
   - 2 fuel cards
   - 2 warehouses
   - 4 stock items
   - 100 blanks (ЧБ 1-100)
   - 2 waybills

🔑 Test credentials:
   admin@test.ru / password123 (admin)
   dispatcher@test.ru / password123 (dispatcher)
   mechanic@test.ru / password123 (mechanic)
```

## Шаг 5: Проверка Prisma Client

Создать тестовый файл `test-prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Получить все организации
  const orgs = await prisma.organization.findMany();
  console.log('Organizations:', orgs);

  // Получить всех пользователей с ролями
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  console.log('Users with roles:');
  users.forEach(user => {
    console.log(`  ${user.fullName} (${user.email})`);
    user.roles.forEach(ur => {
      console.log(`    - Role: ${ur.role.name}`);
      console.log(`      Permissions: ${ur.role.rolePermissions.map(rp => rp.permission.code).join(', ')}`);
    });
  });

  // Получить путевые листы
  const waybills = await prisma.waybill.findMany({
    include: {
      vehicle: true,
      driver: { include: { employee: true } },
      routes: true,
      fuelLines: { include: { stockItem: true } },
    },
  });

  console.log('\nWaybills:');
  waybills.forEach(wb => {
    console.log(`  ${wb.number} (${wb.date.toISOString().slice(0, 10)})`);
    console.log(`    Vehicle: ${wb.vehicle.registrationNumber}`);
    console.log(`    Driver: ${wb.driver.employee.fullName}`);
    console.log(`    Status: ${wb.status}`);
    console.log(`    Routes: ${wb.routes.length}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Запустить:

```bash
npx ts-node test-prisma.ts
```

## Шаг 6: Запуск Prisma Studio (GUI)

```bash
npm run prisma:studio
```

Откроется браузер на `http://localhost:5555`

**Что можно делать:**
- Просматривать все 23 таблицы
- Редактировать записи
- Добавлять новые записи
- Удалять записи
- Видеть связи между таблицами

## Шаг 7: Запуск backend сервера

```bash
npm run dev
```

**Ожидаемый вывод:**
```
[nodemon] starting `ts-node src/server.ts`
API server is running on http://localhost:3001
Database connected successfully
```

## Тестирование API

### Вход в систему

```bash
# PowerShell
$Body = @{
    email = "admin@test.ru"
    password = "password123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $Body -ContentType "application/json"
```

**Ответ:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "admin@test.ru",
    "fullName": "Иванов Иван Иванович",
    "roles": ["admin"]
  }
}
```

### Получить путевые листы

```bash
$Token = "YOUR_ACCESS_TOKEN_HERE"
$Headers = @{ "Authorization" = "Bearer $Token" }

Invoke-RestMethod -Uri "http://localhost:3001/api/waybills" -Method GET -Headers $Headers
```

## Troubleshooting

### Проблема 1: "Could not connect to database"

**Решение:**
1. Проверить, что PostgreSQL запущен:

```bash
# Windows Services
services.msc
# Найти "postgresql-x64-13" или подобное
```

2. Проверить DATABASE_URL в `.env`
3. Проверить пароль PostgreSQL

### Проблема 2: "Error: P1001: Can't reach database server"

**Возможные причины:**
- Firewall блокирует порт 5432
- PostgreSQL слушает не на 127.0.0.1

**Решение:**

```bash
# Проверить postgresql.conf
# Должно быть:
listen_addresses = 'localhost'

# И pg_hba.conf:
host    all             all             127.0.0.1/32            md5
```

Перезапустить PostgreSQL.

### Проблема 3: "Windows Firewall блокирует Node.js"

Выполнить скрипт:

```bash
.\add-node-to-firewall.ps1
```

### Проблема 4: Prisma не находит gen_random_uuid()

**Причина:** PostgreSQL < 13

**Решение 1:** Обновить PostgreSQL до версии 13+

**Решение 2:** Изменить в schema.prisma:

```prisma
// Было:
@default(dbgenerated("gen_random_uuid()"))

// Стало:
@default(uuid())
```

Затем пересоздать миграцию:

```bash
npm run prisma:migrate reset
npm run prisma:migrate dev --name use_uuid_function
```

### Проблема 5: Seed падает с ошибкой "Unique constraint failed"

**Причина:** Seed уже был запущен

**Решение:**

```bash
# Полный сброс БД
npm run prisma:migrate reset

# Заново seed
npm run prisma:seed
```

## Следующие шаги

1. ✅ **Схема развёрнута** - база готова
2. 📝 **Обновить controllers** - добавить эндпоинты для новых моделей
3. 🔐 **Настроить RBAC middleware** - проверка прав
4. 📊 **Синхронизировать frontend** - обновить types.ts
5. 🧪 **Написать тесты** - unit + integration

## Полезные команды

```bash
# Открыть Prisma Studio
npm run prisma:studio

# Сгенерировать Prisma Client вручную
npm run prisma:generate

# Создать новую миграцию
npx prisma migrate dev --name your_migration_name

# Посмотреть статус миграций
npx prisma migrate status

# Применить pending миграции
npx prisma migrate deploy

# Полностью пересоздать БД (ОСТОРОЖНО!)
npx prisma migrate reset

# Форматировать schema.prisma
npx prisma format

# Валидация схемы
npx prisma validate
```

## Документация

- [Prisma Docs](https://www.prisma.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Express.js](https://expressjs.com/)
- [JWT Authentication](https://jwt.io/)

---

**Поддержка:** Если возникли проблемы, проверьте:
1. [TROUBLESHOOTING.md](file:///c:/_PL-tests/TROUBLESHOOTING.md)
2. [backend/STATUS.md](file:///c:/_PL-tests/backend/STATUS.md)
3. GitHub Issues проекта
