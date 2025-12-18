# 🚀 Backend Setup - Step by Step Guide

**Текущий статус:** PostgreSQL запущен ✅, зависимости установлены ✅

---

## ✅ Что уже готово:

1. ✅ PostgreSQL сервис запущен (проверено: `Get-Service PostgreSQL`)
2. ✅ NPM пакеты установлены (`npm install`)
3. ✅ Prisma 5.22.0 и @prisma/client установлены

---

## 📝 ШАГ 1: Создать .env файл

**В PowerShell** (в папке `backend/`):

```powershell
cd c:\_PL-tests\backend

# Создать .env файл
@"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/waybills?schema=public"
PORT=3000
JWT_SECRET="dev_secret_key_change_in_production_12345678"
JWT_EXPIRES_IN="15m"
NODE_ENV="development"
"@ | Out-File -FilePath .env -Encoding ASCII -NoNewline
```

**Или вручную:**
1. Создайте файл `.env` в папке `backend/`
2. Скопируйте содержимое:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/waybills?schema=public"
PORT=3000
JWT_SECRET="dev_secret_key_change_in_production_12345678"
JWT_EXPIRES_IN="15m"
NODE_ENV="development"
```

**Проверить:**
```powershell
Get-Content .env
```

---

## 📝 ШАГ 2: Создать базу данных PostgreSQL

Нужно создать БД `waybills` в PostgreSQL.

**Вариант А: Через psql (если доступен)**

Найдите `psql.exe` в папке установки PostgreSQL (обычно `C:\Program Files\PostgreSQL\<version>\bin\psql.exe`):

```powershell
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "CREATE DATABASE waybills;"
```

Введите пароль PostgreSQL когда попросит.

**Вариант Б: Через pgAdmin**

1. Откройте pgAdmin
2. Подключитесь к серверу PostgreSQL
3. Правый клик на `Databases` → `Create` → `Database`
4. Имя: `waybills`
5. Save

**Вариант В: Автоматически через Prisma (если БД не создастся)**

Prisma может создать БД автоматически при первой миграции (но не всегда работает).

---

## 📝 ШАГ 3: Prisma Generate

Генерирует Prisma Client из schema:

```powershell
npm run prisma:generate
```

Ожидаемый вывод:
```
✔ Generated Prisma Client to ./node_modules/@prisma/client
```

---

## 📝 ШАГ 4: Prisma Migrate

Создает таблицы в БД:

```powershell
npm run prisma:migrate
```

Prisma спросит имя миграции, введите: **`init`**

Ожидаемый вывод:
```
Applying migration `20241127_init`
The following migration(s) have been applied:

migrations/
  └─ 20241127_init/
      └─ migration.sql

✔ Generated Prisma Client
```

**Если ошибка подключения к БД:**
- Проверьте DATABASE_URL в .env
- Убедитесь что БД `waybills` создана
- Проверьте пароль PostgreSQL (по умолчанию часто `postgres`)

---

## 📝 ШАГ 5: Prisma Seed

Заполняет БД тестовыми данными:

```powershell
npm run prisma:seed
```

Ожидаемый вывод:
```
🌱 Seeding database...
✅ Organization created: Тестовая организация
✅ Admin user created: admin@test.ru
📧 Email: admin@test.ru
🔑 Password: admin123
✅ Dispatcher user created: dispatcher@test.ru
📧 Email: dispatcher@test.ru
🔑 Password: dispatcher123
✅ Created 2 test vehicles
✅ Created 2 test drivers
✅ Created 2 test waybills

🎉 Seeding completed successfully!
```

**Тестовые пользователи:**
- `admin@test.ru` / `admin123` (роль: admin)
- `dispatcher@test.ru` / `dispatcher123` (роль: dispatcher)

---

## 📝 ШАГ 6: Запустить Backend

```powershell
npm run dev
```

Ожидаемый вывод:
```
🚀 Backend running on http://localhost:3000
📊 Environment: development
🔗 API endpoints available at http://localhost:3000/api
❤️  Health check: http://localhost:3000/api/health
```

**Если ошибка:**
- Проверьте .env файл
- Убедитесь что миграции применены
- Проверьте логи на предмет ошибок подключения к БД

---

## 📝 ШАГ 7: Тестирование API

**В новом терминале PowerShell:**

### 7.1. Health Check

```powershell
curl http://localhost:3000/api/health
```

Ожидаемый ответ:
```json
{"status":"ok","timestamp":"2024-11-28T..."}
```

### 7.2. Login (Admin)

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@test.ru","password":"admin123"}'

$TOKEN = $response.accessToken
Write-Host "Token: $TOKEN"
Write-Host "User: $($response.user.fullName)"
```

Ожидаемый ответ:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@test.ru",
    "fullName": "Администратор Системы",
    "organizationId": "...",
    "organizationName": "Тестовая организация",
    "role": "admin"
  }
}
```

### 7.3. Get Vehicles

```powershell
$headers = @{ "Authorization" = "Bearer $TOKEN" }
Invoke-RestMethod -Uri "http://localhost:3000/api/vehicles" -Headers $headers | ConvertTo-Json
```

Ожидается: 2 транспортных средства

### 7.4. Get Drivers

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/drivers" -Headers $headers | ConvertTo-Json
```

Ожидается: 2 водителя

### 7.5. Get Waybills

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/waybills" -Headers $headers | ConvertTo-Json
```

Ожидается: 2 путевых листа

---

## 🎯 Критерии успеха

После всех шагов, должно быть:

- [ ] `.env` файл создан с правильными параметрами
- [ ] База данных `waybills` создана в PostgreSQL
- [ ] `npm run prisma:generate` выполнен успешно
- [ ] `npm run prisma:migrate` создал таблицы
- [ ] `npm run prisma:seed` заполнил тестовыми данными
- [ ] `npm run dev` запустил сервер без ошибок
- [ ] `GET /api/health` возвращает `{"status":"ok"}`
- [ ] `POST /api/auth/login` возвращает accessToken
- [ ] `GET /api/vehicles` возвращает 2 ТС (с токеном)
- [ ] `GET /api/drivers` возвращает 2 водителей (с токеном)
- [ ] `GET /api/waybills` возвращает 2 путевых листа (с токеном)

---

## 🐛 Troubleshooting

### Ошибка: "Cannot connect to database"

**Решение:**
1. Проверьте что PostgreSQL сервис запущен:
   ```powershell
   Get-Service PostgreSQL
   ```
2. Проверьте DATABASE_URL в .env
3. Проверьте что БД `waybills` создана

### Ошибка: "column does not exist" или schema errors

**Решение:**
1. Удалите все миграции:
   ```powershell
   Remove-Item -Recurse -Force prisma\migrations
   ```
2. Пересоздайте миграции:
   ```powershell
   npm run prisma:migrate
   ```

### Ошибка: "User already exists" при seed

**Решение:**
Seed можно запускать только один раз. Если нужно пересоздать данные:
```powershell
npx prisma migrate reset
npm run prisma:seed
```
⚠️ **ВНИМАНИЕ:** `migrate reset` удалит ВСЕ данные!

### Port 3000 already in use

**Решение:**
Измените PORT в .env на другой (например, 3001)

---

## 💡 Полезные команды

```powershell
# Открыть Prisma Studio (GUI для БД)
npx prisma studio

# Посмотреть статус миграций
npx prisma migrate status

# Пересоздать БД с нуля (⚠️ удалит все данные)
npx prisma migrate reset

# Форматировать schema.prisma
npx prisma format
```

---

## ✅ Если все работает

**Следующие шаги:**
1. ✅ Интеграция с фронтендом
2. ✅ Добавление валидации (zod)
3. ✅ Refresh tokens
4. ✅ Тесты

**Текущий статус:** Backend полностью готов к использованию! 🎉
