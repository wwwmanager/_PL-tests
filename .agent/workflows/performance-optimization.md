---
description: Performance Optimization Plan
---

# План оптимизации производительности

## Цель
Уменьшить размер бандла, улучшить время загрузки и отзывчивость интерфейса.

## Этап 1: Разделение mockApi.ts (87KB → ~20KB каждый)

### 1.1 Создать отдельные модули
- `services/api/organizations.ts` - Organizations CRUD
- `services/api/vehicles.ts` - Vehicles CRUD
- `services/api/employees.ts` - Employees CRUD
- `services/api/waybills.ts` - Waybills CRUD
- `services/api/blanks.ts` - Blanks management
- `services/api/stock.ts` - Stock and garage management
- `services/api/core.ts` - Shared utilities (generateId, clone, etc)

### 1.2 Создать index-файл
- `services/api/index.ts` - Re-export всех API функций

## Этап 2: Оптимизация компонентов

### 2.1 WaybillDetail.tsx
- ✅ RouteRow уже вынесен и мемоизирован
- Добавить React.memo для вложенных компонентов
- Использовать useCallback для обработчиков
- Lazy loading для RouteImportModal и PrintableWaybill

### 2.2 Dashboard
- Мемоизация графиков (recharts)
- useCallback для обработчиков событий

### 2.3 Admin компоненты
- Виртуализация длинных списков (react-window)
- Пагинация для больших таблиц

## Этап 3: Bundle optimization

### 3.1 Vite config
- Включить code splitting
- Tree shaking для неиспользуемого кода
- Compression (gzip/brotli)

### 3.2 Lazy imports
- Динамические импорты для роутов
- Suspense boundaries

## Этап 4: Runtime optimization

### 4.1 Мемоизация
- useMemo для тяжелых вычислений
- useCallback для стабильных функций
- React.memo для pure components

### 4.2 IndexedDB оптимизация
- Batch updates
- Debounce для сохранений

## Метрики успеха

- Bundle size: < 500KB (gzipped)
- Initial load: < 2s
- Time to Interactive: < 3s
- Lighthouse Score: > 90

## Приоритет

1. **HIGH**: Разделение mockApi.ts
2. **MEDIUM**: Мемоизация компонентов
3. **MEDIUM**: Bundle optimization
4. **LOW**: Виртуализация списков
