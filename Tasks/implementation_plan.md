# Central Mode Backend Integration Plan

## Проблема

Сейчас приложение работает в "старом" режиме:

- ✅ Окно логина формально есть, но не используется — DEV автологин.
- ✅ Данные ПЛ в Central mode берутся из IndexedDB/LocalForage, а не из backend.
- ✅ Разные браузеры/окна видят разные данные — standalone режим.

**Цель:** перевести Central mode на работу через backend, локальное хранилище использовать только для Driver/offline режима.

---

## Найденные проблемы

### 1. DEV Autologin (КРИТИЧНО)

Файл: `services/auth.tsx`

```ts
if (import.meta.env.DEV) {
  const dev: User = {
    id: 'dev-admin',
    role: defaultRole,
    displayName: 'Admin (DEV)',
  };
  setCurrentUser(dev);
  await saveJSON(CURRENT_USER_KEY, dev);
}
```

**Проблема:** В DEV режиме пользователь автоматически логинится без ввода пароля.

**Решение:** Отключить автологин в Central mode, оставить только для Driver mode.

---

### 2. Разные backend endpoints

**Файл:** [auth.tsx](file:///c:/_PL-tests/services/auth.tsx#L35)
```typescript
const API_BASE = 'http://localhost:4000/api';
```

**Файл:** [httpClient.ts](file:///c:/_PL-tests/services/httpClient.ts#L6)
```typescript
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
```

**Проблема:** 
- Auth идёт на порт **4000** (простой сервер из `backend/index.ts`)
- Waybills идут на порт **3001** (TypeORM сервер)

**Решение:** Унифицировать на **3001** (TypeORM backend)

---

### 3. waybillApi hardcoded

**Файл:** [waybillApi.ts](file:///c:/_PL-tests/services/waybillApi.ts#L13)
```typescript
const USE_REAL_API = true; // import.meta.env.VITE_USE_REAL_API === 'true';
```

**Состояние:** ✅ Хорошо для отладки

**Риск:** Другие компоненты могут использовать `mockApi` напрямую

---

## Предлагаемые изменения

### Phase 1: Исправить авторизацию

#### [MODIFY] [auth.tsx](file:///c:/_PL-tests/services/auth.tsx)

**Изменение 1:** Унифицировать backend URL (строка 35)
```typescript
// Было:
const API_BASE = 'http://localhost:4000/api';

// Стало:
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
```

**Изменение 2:** Убрать DEV автологин из Central mode (строки 163-176)
```typescript
// Было:
if (import.meta.env.DEV) {
  const dev: User = {
    id: 'dev-admin',
    role: defaultRole,
    displayName: 'Admin (DEV)',
  };
  setCurrentUser(dev);
  await saveJSON(CURRENT_USER_KEY, dev);
} else {
  // PROD: требуем login
  setCurrentUser(null);
}

// Стало:
// Проверяем режим приложения
const settings = await getAppSettings();
const isDriverMode = settings?.appMode === 'driver';

if (import.meta.env.DEV && isDriverMode) {
  // Driver mode: можно использовать DEV автологин для offline
  const dev: User = {
    id: 'dev-driver',
    role: 'driver',
    displayName: 'Driver (DEV Offline)',
  };
  setCurrentUser(dev);
  await saveJSON(CURRENT_USER_KEY, dev);
} else {
  // Central mode ИЛИ PROD: требуем реальный login
  setCurrentUser(null);
}
```

---

#### [MODIFY] [App.tsx](file:///c:/_PL-tests/App.tsx)

**Изменение:** Убрать defaultRole (строка 235)
```typescript
// Было:
<AuthProvider defaultRole="admin">

// Стало:
<AuthProvider>
```

**Обоснование:** defaultRole используется для DEV автологина, который мы отключаем

---

### Phase 2: Проверить использование API

#### [CHECK] [WaybillList.tsx](file:///c:/_PL-tests/components/waybills/WaybillList.tsx)

Убедиться, что использует `waybillApi`, а не `mockApi` напрямую:
```typescript
// Правильно:
import { getWaybills, addWaybill } from '../../services/waybillApi';

// Неправильно:
import * as mockApi from '../../services/mockApi';
```

#### [CHECK] [Dashboard.tsx](file:///c:/_PL-tests/components/dashboard/Dashboard.tsx)

Убедиться, что данные берутся из `waybillApi`:
```typescript
// Правильно:
import { getWaybills } from '../../services/waybillApi';

// Неправильно:
import { getWaybills } from '../../services/mockApi';
```

---

### Phase 3: Настроить httpClient

#### [MODIFY] [httpClient.ts](file:///c:/_PL-tests/services/httpClient.ts)

**Проверка 1:** Убедиться, что URL correct
```typescript
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
```

**Проверка 2:** Проверить токен извлекается из правильного места

Текущая логика: `localStorage.getItem('accessToken')`

Должно совпадать с `auth.tsx`: `localStorage.getItem('__auth_token__')`

**Изменение:** Синхронизировать ключи
```typescript
// В httpClient.ts
const TOKEN_KEY = '__auth_token__'; // было: 'accessToken'

export function setAccessToken(token: string | null) {
    accessToken = token;
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

export function getAccessToken(): string | null {
    if (!accessToken) {
        accessToken = localStorage.getItem(TOKEN_KEY);
    }
    return accessToken;
    token: string,
    user: User
  }
}
```

**Проверить:** Соответствует ли backend на 3001?

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
```

**Если нужно:** Добавить auth endpoints в TypeORM backend

---

## Verification Plan

### Test 1: Login Flow

**Запустить:**
```bash
# Backend
cd c:\_PL-tests\backend
npm run dev

# Frontend  
cd c:\_PL-tests
npm run dev
```

**Действия:**
1. Открыть `http://localhost:5173`
2. **Ожидается:** Экран логина (НЕ автовход)
3. Ввести: `admin@example.com` / `Admin123!`
4. **Ожидается:** Успешный вход в приложение

**Логи Backend:**
```
POST /api/auth/login
User: admin@example.com
Token generated: ...
```

**Логи Frontend (console):**
```
🌐 POST http://localhost:3001/api/auth/login
✅ Status 200
Token saved to localStorage
```

---

### Test 2: Waybill Creation (Cross-Browser)

**Browser 1:**
1. Login как admin
2. Создать путевой лист TEST-001
3. **Ожидается:** 201 Created

**Browser 2 (другой профиль/окно):**
1. Login как admin (тот же пользователь)
2. Перейти в список ПЛ
3. **Ожидается:** TEST-001 виден в списке

**Логи Backend:**
```
POST /api/waybills (Browser 1)
  Created: TEST-001

GET /api/waybills (Browser 2)
  Returned: [TEST-001, ...]
```

---

### Test 3: Logout Flow

**Действия:**
1. Logout
2. **Ожидается:** Возврат на экран логина
3. `localStorage.__auth_token__` удалён
4. Повторная попытка открыть /waybills → redirect на login

---

## Success Criteria

- [ ] В DEV режиме показывается экран логина (НЕ автовход)
- [ ] Login через реальный backend (3001) работает
- [ ] JWT токен сохраняется в localStorage
- [ ] Все запросы идут с Authorization header
- [ ] Созданные ПЛ видны во всех браузерах/окнах
- [ ] Logout корректно очищает токен
- [ ] IndexedDB не используется для хранения ПЛ в Central mode

---

## Rollback Plan

Если что-то сломается:

1. **Вернуть автологин:**
   ```typescript
   if (import.meta.env.DEV) {
     setCurrentUser({ id: 'dev-admin', role: 'admin', displayName: 'Admin' });
   }
   ```

2. **Временно вернуть mockApi:**
   ```typescript
   const USE_REAL_API = false;
   ```

3. **Проверить .env файл:**
   ```
   VITE_API_URL=http://localhost:3001/api
   VITE_USE_REAL_API=true
   ```
