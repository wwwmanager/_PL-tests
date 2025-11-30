# Central Mode Backend Integration Task

## Main Objective
Перевести Central mode на полную работу через backend API, убрать автологин и локальное хранилище из Central mode.

## Current Problems

### Problem 1: DEV Autologin
**Найдено:** В `services/auth.tsx` строки 165-172
```typescript
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
**Результат:** Пользователь автоматически логинится без ввода пароля

### Problem 2: Два разных backend
**Найдено:** 
- `auth.tsx` использует `http://localhost:4000/api` (строка 35)
- `waybillApi.ts` использует `http://localhost:3001/api` (через httpClient)
**Результат:** Auth и данные идут на разные backend

### Problem 3: waybillApi hardcoded USE_REAL_API
**Найдено:** В `waybillApi.ts` строка 13: `const USE_REAL_API = true;`
**Хорошо:** Захардкожен на true для отладки
**Плохо:** Другие компоненты могут использовать mockApi напрямую

### Problem 4: Локальное хранилище всё ещё используется
**Потенциально:** Компоненты Dashboard, WaybillList могут читать из IndexedDB
**Нужно проверить:** Все ли компоненты используют API фасады

## Implementation Plan

### Phase 1: Fix Authentication ✅ COMPLETED
- [x] Унифицировать backend URL (3001 для всех) ✅
- [x] Отключить автологин в Central mode (auth.tsx) ✅
- [x] Настроить httpClient с правильным токеном backend ✅
- [x] Убрать defaultRole prop из App.tsx ✅
- [x] DEV autologin работает только в Driver mode ✅
- [x] Исправить TypeScript ошибки в backend ✅
- [x] Очистить и пересоздать PostgreSQL schema ✅
- [x] Создать тестового пользователя (admin@example.com) ✅
- [x] Login screen появляется в Central mode ✅
- [x] **Добавить кнопку Logout** (добавлено + импорт LogoutIcon исправлен) ✅
- [ ] **TEST:** Logout возвращает на login screen

### Phase 2: Verify API Usage
- [ ] Проверить Dashboard использует waybillApi
- [ ] Проверить WaybillList использует waybillApi
- [ ] Проверить Reports использует правильные API
- [ ] Найти прямые импорты mockApi в компонентах

### Phase 3: Configure Modes
- [ ] Определить, где хранится режим Central/Driver
- [ ] Central mode: USE_REAL_API = true + требовать реальный login
- [ ] Driver mode: можно использовать local storage + offline
- [ ] Добавить явный переключатель режима

### Phase 4: Test Complete Flow
- [ ] Test: Login через реальный backend
- [ ] Test: Создание ПЛ в одном браузере
- [ ] Test: Проверка ПЛ виден в другом браузере
- [ ] Test: Logout корректно работает

## Key Files to Modify

1. **services/auth.tsx** (строки 165-172, 35)
   - Отключить DEV autologin
   - Изменить API_BASE на 3001

2. **services/httpClient.ts**
   - Проверить использует правильный URL backend
   - Проверить токен правильно извлекается

3. **App.tsx** (строка 235)
   - Возможно убрать defaultRole="admin"

4. **components/waybills/WaybillList.tsx**
   - Проверить использует waybillApi а не mockApi

5. **components/dashboard/Dashboard.tsx**
   - Проверить использует правильные API

## Success Criteria

- [x] Backend запущен на 3001 ✅
- [x] Central/Driver mode detection работает ✅
- [x] TypeScript ошибки исправлены ✅
- [x] Database schema пересоздана ✅
- [x] Тестовый пользователь создан ✅
- [x] Login экран показывается в Central mode ✅
- [x] Успешный вход с admin@example.com / password ✅
- [/] **Logout button:** Кнопка выхода в sidebar (инструкция готова)
- [ ] **TEST:** Logout успешно возвращает на login screen
- [ ] **TEST:** Driver mode работает с DEV autologin
- [ ] **TEST:** Token persists across page refresh
