# План реализации: Умный справочник маршрутов с автодополнением

## 📋 Анализ текущей реализации

### Что уже есть:
1. ✅ `SavedRoute` тип данных (from, to, distanceKm)
2. ✅ `savedRoutesIndex` - мемоизированная Map для быстрого поиска
3. ✅ Автоматическая подстановка расстояния при совпадении from+to
4. ✅ `addSavedRoutesFromWaybill()` - функция добавления (но не реализована полностью)

### Что нужно доработать:
❌ Автодополнение (autocomplete) при вводе
❌ Автоматическое сохранение новых маршрутов
❌ Предотвращение дублирования
❌ UI для autocomplete

---

## 🎯 Цели задачи

1. **Автоматическое пополнение справочника**
   - При сохранении ПЛ добавлять новые уникальные маршруты
   - Не создавать дубликаты

2. **Умное автодополнение (Autocomplete)**
   - Подсказки пунктов назначения по введенным символам
   - Dropdown с вариантами
   - Быстрый выбор из истории

3. **Управление дублями**
   - Проверка before insert
   - Нормализация данных (trim, lowercase для сравнения)
   - Умное объединение (merge) при совпадении

---

## 📐 Детальный план реализации

### Этап 1: Backend (services/mockApi.ts)

#### 1.1 Реализовать `addSavedRoutesFromWaybill()`
```typescript
export const addSavedRoutesFromWaybill = async (routes: Route[]): Promise<void> => {
  await initFromStorage();
  
  const currentRoutes = await loadJSON(DB_KEYS.SAVED_ROUTES, []);
  
  // Создаем индекс существующих маршрутов
  const existingIndex = new Set(
    currentRoutes.map(r => 
      `${r.from.trim().toLowerCase()}|${r.to.trim().toLowerCase()}`
    )
  );
  
  const newRoutes: SavedRoute[] = [];
  
  for (const route of routes) {
    if (!route.from || !route.to) continue;
    
    const key = `${route.from.trim().toLowerCase()}|${route.to.trim().toLowerCase()}`;
    
    // Пропускаем дубликаты
    if (existingIndex.has(key)) continue;
    
    newRoutes.push({
      id: generateId('route'),
      from: route.from.trim(),
      to: route.to.trim(),
      distanceKm: route.distanceKm || 0,
    });
    
    existingIndex.add(key);
  }
  
  if (newRoutes.length > 0) {
    await saveJSON(DB_KEYS.SAVED_ROUTES, [...currentRoutes, ...newRoutes]);
    broadcast('routes');
  }
};
```

#### 1.2 Добавить функцию поиска для autocomplete
```typescript
export const searchSavedLocations = async (query: string): Promise<string[]> => {
  await initFromStorage();
  const routes = await getSavedRoutes();
  
  const normalizedQuery = query.trim().toLowerCase();
  const locationsSet = new Set<string>();
  
  for (const route of routes) {
    if (route.from.toLowerCase().includes(normalizedQuery)) {
      locationsSet.add(route.from);
    }
    if (route.to.toLowerCase().includes(normalizedQuery)) {
      locationsSet.add(route.to);
    }
  }
  
  return Array.from(locationsSet)
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .slice(0, 10); // Top 10 results
};
```

### Этап 2: Autocomplete Component

#### 2.1 Создать `<AutocompleteInput>` компонент
```typescript
// components/shared/AutocompleteInput.tsx

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ ... }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { /* ... */ }
    if (e.key === 'ArrowUp') { /* ... */ }
    if (e.key === 'Enter') { /* select */ }
    if (e.key === 'Escape') { setIsOpen(false); }
  };
  
  return (
    <div className="relative">
      <input 
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        {...}
      />
      
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, idx) => (
            <li 
              key={idx}
              className={selectedIndex === idx ? 'bg-blue-100' : ''}
              onClick={() => { onChange(suggestion); setIsOpen(false); }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

### Этап 3: Интеграция в RouteRow

#### 3.1 Обновить `RouteRow.tsx`
```typescript
// components/waybills/RouteRow.tsx

import { AutocompleteInput } from '../shared/AutocompleteInput';
import { searchSavedLocations } from '../../services/mockApi';

export const RouteRow = React.memo<RouteRowProps>(({ route, onChange, ... }) => {
  const [fromSuggestions, setFromSuggestions] = useState<string[]>([]);
  const [toSuggestions, setToSuggestions] = useState<string[]>([]);
  
  const handleSearchFrom = useCallback(async (query: string) => {
    if (query.length < 2) {
      setFromSuggestions([]);
      return;
    }
    const results = await searchSavedLocations(query);
    setFromSuggestions(results);
  }, []);
  
  const handleSearchTo = useCallback(async (query: string) => {
    if (query.length < 2) {
      setToSuggestions([]);
      return;
    }
    const results = await searchSavedLocations(query);
    setToSuggestions(results);
  }, []);
  
  return (
    <div>
      {/* От куда */}
      <AutocompleteInput
        value={route.from}
        onChange={(value) => onChange(route.id, 'from', value)}
        suggestions={fromSuggestions}
        onSearch={handleSearchFrom}
        placeholder="Откуда"
      />
      
      {/* Куда */}
      <AutocompleteInput
        value={route.to}
        onChange={(value) => onChange(route.id, 'to', value)}
        suggestions={toSuggestions}
        onSearch={handleSearchTo}
        placeholder="Куда"
      />
      
      {/* ... остальные поля ... */}
    </div>
  );
});
```

### Этап 4: Автосохранение при сохранении ПЛ

#### 4.1 Обновить `WaybillDetail.tsx`
```typescript
const handleSave = async (suppressNotifications = false): Promise<Waybill | null> => {
  // ... existing validation ...
  
  try {
    let savedWaybill: Waybill;
    
    if ('id' in formData && formData.id) {
      savedWaybill = await updateWaybill(formData as Waybill);
    } else {
      savedWaybill = await addWaybill(formData as Omit<Waybill, 'id'>);
    }
    
    // ✅ НОВОЕ: автоматически сохраняем маршруты
    if (savedWaybill && savedWaybill.routes.length > 0) {
      await addSavedRoutesFromWaybill(savedWaybill.routes);
      
      // Перезагружаем savedRoutes для обновления autocomplete
      const updatedRoutes = await getSavedRoutes();
      setSavedRoutes(updatedRoutes);
    }
    
    // ... rest of the code ...
  }
};
```

---

## 🎨 UI/UX улучшения

### Визуальные элементы:

1. **Dropdown с подсказками**
   - Белый фон с тенью
   - Hover эффект (голубая подсветка)
   - Keyboard navigation (↑↓ Enter Esc)

2. **Иконка индикации**
   - 🔍 - когда идет поиск
   - ✓ - когда выбрано из справочника
   - ⚠️ - когда новое значение (будет добавлено)

3. **Статистика**
   - "Использовалось 5 раз" - показывать популярность маршрута
   - "Новый маршрут" - если не найден в справочнике

---

## 🔧 Технические детали

### Оптимизации:

1. **Debounce для поиска**
   ```typescript
   const debouncedSearch = useMemo(
     () => debounce((query: string) => searchSavedLocations(query), 300),
     []
   );
   ```

2. **Кеширование результатов**
   - LRU cache для последних 100 запросов

3. **Мемоизация**
   - `AutocompleteInput` обернуть в `React.memo`
   - `suggestions` передавать только при изменении

### Безопасность:

1. **Валидация входных данных**
   - Trim пробелы
   - Ограничение длины (max 200 символов)
   - Фильтрация спецсимволов

2. **Предотвращение XSS**
   - Экранирование HTML в suggestions

---

## 📊 Тестирование

### Unit тесты:

```typescript
// services/__tests__/savedRoutes.test.ts

describe('addSavedRoutesFromWaybill', () => {
  it('should add unique routes', async () => { /* ... */ });
  it('should skip duplicates', async () => { /* ... */ });
  it('should normalize before comparison', async () => { /* ... */ });
});

describe('searchSavedLocations', () => {
  it('should return matching locations', async () => { /* ... */ });
  it('should be case-insensitive', async () => { /* ... */ });
  it('should limit results to 10', async () => { /* ... */ });
});
```

### E2E тесты:

1. Ввод маршрута с autocomplete
2. Сохранение ПЛ с новым маршрутом
3. Проверка добавления в справочник
4. Повторный ввод того же маршрута (не должен дублироваться)

---

## 📝 План выполнения (Roadmap)

### Фаза 1: Backend (1-2 часа)
- [ ] Реализовать `addSavedRoutesFromWaybill()`
- [ ] Добавить `searchSavedLocations()`
- [ ] Добавить в DB_KEYS константу для SAVED_ROUTES
- [ ] Тесты для новых функций

### Фаза 2: Autocomplete Component (2-3 часа)
- [ ] Создать `AutocompleteInput.tsx`
- [ ] Keyboard navigation
- [ ] Стили и анимации
- [ ] Debounce для поиска

### Фаза 3: Интеграция (1-2 часа)
- [ ] Обновить `RouteRow.tsx`
- [ ] Интегрировать с `WaybillDetail.tsx`
- [ ] Автосохранение при сохранении ПЛ
- [ ] Reload savedRoutes после сохранения

### Фаза 4: Полировка (1-2 часа)
- [ ] UI/UX улучшения
- [ ] Иконки и индикаторы
- [ ] Loading states
- [ ] Error handling

**Общее время**: 5-9 часов

---

## ❓ Вопросы для уточнения

1. **Минимальная длина для autocomplete**
   - Предлагаю: показывать подсказки после 2 символов
   - Ваш вариант?

2. **Максимальное количество подсказок**
   - Предлагаю: 10 записей
   - Больше/меньше?

3. **Сортировка подсказок**
   - По алфавиту?
   - По частоте использования?
   - По релевантности (начинается с... важнее чем содержит)?

4. **Обратные маршруты**
   - "Москва → Казань" и "Казань → Москва" - разные маршруты?
   - Или считать одним и тем же?

5. **Удаление старых маршрутов**
   - Автоматическая очистка неиспользуемых >6 месяцев?
   - Или хранить всё?

6. **Расстояние при дублях**
   - Если маршрут уже есть, но с другим расстоянием?
   - Обновлять на среднее?
   - Игнорировать?

---

## ✅ Следующие шаги

После согласования плана:
1. Начнем с backend (Фаза 1)
2. Затем UI компонент (Фаза 2)
3. Интеграция (Фаза 3)
4. Полировка (Фаза 4)

Или можем реализовать MVP по частям для быстрого тестирования!

Что скажете? Есть корректировки к плану?
