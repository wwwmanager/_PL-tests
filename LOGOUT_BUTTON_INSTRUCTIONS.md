## Добавление кнопки Logout в приложение

### Шаг 1: Добавить `logout` в useAuth

**Файл:** `App.tsx`  
**Строка 57:**

Изменить:
```typescript
const { hasRole, currentUser } = useAuth();
```

На:
```typescript
const { hasRole, currentUser, logout } = useAuth();
```

---

###  Шаг 2: Добавить кнопку Logout в sidebar

**Файл:** `App.tsx`  
**Строки 209-211:**

Заменить:
```typescript
        <div className="p-4 border-t dark:border-gray-700">
          <DevRoleSwitcher />
        </div>
```

На:
```typescript
        <div className="p-4 border-t dark:border-gray-700">
          <DevRoleSwitcher />
          <button
            onClick={async () => {
              if (confirm('Вы уверены, что хотите выйти?')) {
                await logout();
              }
            }}
            className="flex items-center w-full p-2 mt-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <LogoutIcon className="w-5 h-5" />
            <span className="ml-3 font-medium text-sm">Выход</span>
          </button>
        </div>
```

---

### Результат

После добавления кнопки "Выход" появится внизу sidebar под DevRoleSwitcher.

При нажатии:
1. Появится подтверждение "Вы уверены, что хотите выйти?"
2. При подтверждении:
   - Вызовется `logout()`
   - Токен удалится
   - Пользователь вернётся на Login screen
