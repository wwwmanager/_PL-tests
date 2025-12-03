# APPLICATION CONTEXT

## 1. Общий обзор проекта

- **Название:** Waybill App  
- **Версия:** 1.0.0  
- **Назначение:** управление путевыми листами, транспортом, водителями, бланками и складом для автопредприятий.  
- **Режимы работы:**
  - **Driver Mode** — офлайн/локальный режим для водителей, хранение данных в IndexedDB.
  - **Central Mode** — централизованный режим для диспетчеров/администраторов, данные в общей БД через backend API.

---

## 2. Технологический стек

### Frontend

- **React** 19 + **TypeScript** + **Vite**
- **TailwindCSS**
- **Формы:** React Hook Form + Zod
- **Хранение (Driver/offline):** IndexedDB через LocalForage (mockApi + локальная БД)
- **Тесты:** Vitest + Testing Library
- **Запуск dev:** `npm run dev` → http://localhost:3000/_PL-tests/ (адрес может отличаться)

### Backend

В данный момент есть два исторических варианта, но **основным считается TypeORM backend**:

1. **Auth Server (legacy, порт 4000)**  
   - Файл: `backend/index.ts`  
   - In‑memory users, простой JWT login.  
   - Использовался как временное решение для аутентификации.  
   - **Статус:** legacy, планируется заменить/объединить с основным backend на 3001.

2. **TypeORM Backend (основной, порт 3001)** ⭐  
   - Файл запуска: `backend/src/server.ts`  
   - Стек:
     - Node.js + Express
     - PostgreSQL
     - TypeORM
   - Функциональность:
     - `/api/health`
     - `/api/waybills` — CRUD путевых листов (сейчас: list + create стабильно работают)
     - `/api/vehicles` — CRUD транспорта
     - `/api/employees` — CRUD сотрудников (включая водителей)
     - `/api/auth` — в процессе/частично (нужно унифицировать с фронтом)

---

## 3. Архитектура и ключевые решения

### 3.1. Frontend

    - вход по login/password через backend API.

### 3.2. Backend

- **Слоистая архитектура:**
  - routes → controllers → services → TypeORM (репозитории)
- **Основные сущности (на TypeORM):**
  - Organization, Department
  - User, Role, Permission, UserRole, RolePermission
  - Employee (с типом 'driver', 'dispatcher' и др.)
  - Vehicle, FuelCard
  - Waybill, WaybillRoute, WaybillFuel
  - BlankBatch, Blank
  - StockItem, Warehouse, StockMovement
  - AuditLog, RefreshToken
- **Принципы:**
  - Organization isolation: все запросы фильтруются по `organizationId` (из JWT).
  - Планируется и частично реализовано:
    - state machines на backend (как на фронте),
    - audit logging,
    - RBAC на уровне backend.

---

## 4. Правила и соглашения

### 4.1. Central vs Driver Mode

- **Central Mode (Цель):**
  - Источник данных → backend (Express + TypeORM на порту 3001).
  - Все операции с ПЛ/ТС/водителями должны идти через API:
    - ПЛ: `/api/waybills`
    - ТС: `/api/vehicles`
    - Водители: `/api/employees?type=driver`
  - **Нельзя** использовать IndexedDB как источник правды для ПЛ в Central mode.
  - Авторизация через реальный login (`/api/auth/login`), JWT хранится и используется httpClient'ом.

- **Driver Mode:**
  - Можно использовать локальное хранилище и mockApi.
  - Допускается DEV‑автологин (упрощённый вход без пароля) **только** в Driver/offline режиме.
  - Backend может быть недоступен → система продолжает работать локально.

### 4.2. Авторизация и токены

- В планах/частично реализовано:
  - `/api/auth/login` (backend на 3001) → возвращает JWT и данные пользователя.
  - Фронтенд:
    - хранит токен под единым ключом (`auth_token`) в localStorage,
    - httpClient добавляет `Authorization: Bearer <token>` к каждому запросу.
  - Refresh tokens — запланированы (модель `RefreshToken` уже есть в схеме).

### 4.3. Использование mockApi vs backend API

- Все компоненты/UI должны работать через фасады (`*Api.ts`), а не напрямую с `mockApi`.
- Пример:
  - **Правильно:** `import { getWaybills } from 'services/waybillApi';`
  - **Неправильно:** `import { getWaybills } from 'services/mockApi';`
- В Central mode:
  - `VITE_USE_REAL_API=true` → `waybillApi` должен использовать backend.
- В Driver mode:
  - Допускается `VITE_USE_REAL_API=false` → `waybillApi` использует mockApi + IndexedDB.

---

## 5. Текущий статус реализации и миграций

### 5.1. Путевые листы (Waybills)

- **Frontend:**
  - Полный функционал на mockApi (CRUD, стейт‑машина, инварианты).
  - Реализован adapter‑слой:
    - `realWaybillApi` → ходит на backend `/api/waybills`.
    - `waybillApi` → фасад, умеет переключаться между real/mock.
  - В dev сейчас adapter для ПЛ уже использует backend (жёстко или через `VITE_USE_REAL_API`).

- **Backend (3001, TypeORM):**
  - `/api/waybills`:
    - `GET /api/waybills` — список ПЛ (работает).
    - `POST /api/waybills` — создание ПЛ (работает, с логированием и базовой валидацией).
    - update/delete/status — частично/в процессе реализации.
  - Связи:
    - Waybill ↔ Vehicle, Driver, Organization, Department, (опционально) Blank, FuelCard.
  - TypeORM auto-sync создал таблицу `waybills` с колонками (включая `blankId`).

- **Состояние миграции:**
  - Часть фронта (Central mode) уже использует backend для списка и создания ПЛ.
  - Ещё остаются компоненты, которые читают ПЛ из IndexedDB/mockApi — нужно постепенно переводить на `waybillApi`.

### 5.2. Vehicles и Drivers

- Backend:
  - `/api/vehicles` и `/api/employees` (включая водителей) реализованы и работают (TypeORM).
- Frontend:
  - Есть mockApi‑реализация.
  - Требуется adapter‑слой по аналогии с ПЛ и переключение UI на этот фасад.

### 5.3. Бланки, склад, топливные карты

- Модели и связи есть в TypeORM/Prisma‑схеме.
- Логика и UI пока в основном живут в mockApi/frontend.
- Интеграция с backend запланирована на следующие фазы.

### 5.4. ORM‑слой

- **TypeORM** — основной ORM для runtime (production‑ориентированный backend).
- **Prisma**:
  - Полная схема (23 модели) и client успешно скачаны.
  - Может использоваться как «источник схемы/анализа», но в основном backend сейчас завязан на TypeORM.

---

## 6. Roadmap и приоритеты

### Phase 1 — Стабилизация backend и Central mode (1–2 месяца)

- Завершить миграцию Central mode на backend:
  - отключить DEV‑автологин в Central mode,
  - унифицировать auth на backend: `/api/auth/login` на 3001,
  - убедиться, что все ПЛ/ТС/водители в Central mode читаются из backend (не из IndexedDB).
- Безопасность:
  - реализовать refresh tokens,
  - добавить rate limiting на `/auth/login`,
  - усилить backend‑валидацию (Zod/аналог).
- Инфраструктура:
  - Docker (backend + Postgres),
  - базовый CI (lint+test+build backend и фронта),
  - логирование/monitoring на backend.

### Phase 2 — Оптимизация и UX

- Разделение `mockApi.ts` на модули.
- Виртуализация больших списков (WaybillList, Vehicles, Drivers).

### 8.2. Поведение при старте КАЖДОЙ новой сессии

После того как AI:
- прочитал `APPLICATION_CONTEXT.md`,
- прочитал `implementation_plan.md` (если есть),
- прочитал `task.md` (если есть),

**AI ОБЯЗАН явно сообщить об этом пользователю в первом ответе сессии.**

**Формат сообщения:**

```
Контекст загружен:
- APPLICATION_CONTEXT.md прочитан
- implementation_plan.md (Central Mode Backend Integration Plan) прочитан
- task.md прочитан

Согласно текущему плану, предлагаю следующие шаги:
1) …
2) …
3) …
```

**Важно:**
- Не пересказывать полностью все файлы, но опираться на них.
- Следующие шаги должны быть согласованы с `implementation_plan.md` и `task.md`.
- Если план явно устарел (часть шагов уже выполнена) — сразу указать и предложить обновить файлы.

### 8.3. Если пользователь сразу даёт конкретную команду

- Сначала кратко подтвердить, что контекст и план загружены.
- Затем соотнести команду с текущим планом (подходит / требует корректировки).
- При необходимости предложить обновление `implementation_plan.md` / `task.md`, а уже потом переходить к выполнению.

---

=== END OF PROJECT CONTEXT & PLANNING MANAGEMENT ===