# Backend для системы управления путевыми листами

Минимальный Express + TypeScript backend с JWT аутентификацией.

## Установка

```bash
npm install
```

## Запуск в dev режиме

```bash
npm run dev
```

Backend запустится на `http://localhost:4000`

## Тестовые пользователи

- **admin@example.com** / **Admin123!** - Администратор (полный доступ)
- **driver@example.com** / **Driver123!** - Водитель (ограниченный доступ)
- **user@example.com** / **User123!** - Обычный пользователь

## API Endpoints

### POST /api/auth/login
Вход в систему

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "Admin123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "u-admin",
      "email": "admin@example.com",
      "displayName": "Администратор",
      "role": "admin",
      "isActive": true
    }
  }
}
```

### GET /api/auth/me
Получить текущего пользователя

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "u-admin",
    "email": "admin@example.com",
    "displayName": "Администратор",
    "role": "admin"
  }
}
```

### POST /api/auth/logout
Выход из системы

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": null
}
```

## Конфигурация фронтенда

Создайте `.env.local` в корне фронтенд проекта:

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

## Production

⚠️ **ВАЖНО:** Этот backend только для разработки и демонстрации!

Для production нужно:
1. Использовать реальную БД (PostgreSQL, MongoDB)
2. Хэшировать пароли (bcrypt)
3. Настроить HTTPS
4. Добавить rate limiting
5. Настроить CORS для конкретного домена
6. Использовать сильный JWT_SECRET
7. Добавить refresh tokens
8. Логирование и мониторинг
