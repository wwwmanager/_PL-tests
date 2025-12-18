# Изменения для синхронизации auth.tsx и httpClient

## 1. Добавить импорт в auth.tsx (после строки 10):

```typescript
import { setAccessToken } from './httpClient';
```

## 2. Обновить функцию login (строка 215-223):

```typescript
  // Реальный login через backend
  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await apiLogin(email, password);
    setCurrentUser(user);
    setToken(token);
    await saveJSON(CURRENT_USER_KEY, user);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
    // Синхронизировать токен с httpClient
    setAccessToken(token);
  }, []);
```

## 3. Обновить функцию logout (строка 231-239):

```typescript
  const logout = useCallback(async () => {
    await apiLogout(token);
    setCurrentUser(null);
    setToken(null);
    await removeKey(CURRENT_USER_KEY);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
    }
    // Синхронизировать токен с httpClient
    setAccessToken(null);
  }, [token]);
```

## 4. Убрать defaultRole из AuthProvider (строка 112-114):

```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
```

## 5. Убрать defaultRole из зависимостей useEffect (строка 190):

```typescript
  }, [fetchPolicies, token]);
```

## Итого:
- Токены синхронизированы между auth.tsx и httpClient
- defaultRole удалён
- Central Mode требует реальный login
- Driver Mode в DEV имеет автологин
