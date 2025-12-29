# Component Design Guide — UI-DESIGN-001

> Краткий гайд по использованию дизайн-токенов из `tokens.ts`

## Buttons

```tsx
import { button } from '../design/tokens';

// Primary action
<button className={`${button.base} ${button.primary}`}>
  Сохранить
</button>

// Danger action
<button className={`${button.base} ${button.danger}`}>
  Удалить
</button>

// Full combo examples:
const buttonClasses = {
  primary: 'bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-colors',
  secondary: 'bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-gray-600 transition-colors',
  success: 'bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-teal-700 transition-colors',
  danger: 'bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-700 transition-colors',
};
```

---

## Status Badges

```tsx
import { statusBadge } from '../design/tokens';

// Generic usage
<span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge.success}`}>
  Активен
</span>

// Waybill statuses (from constants.ts)
const WAYBILL_BADGE = {
  DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  SUBMITTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  POSTED: 'bg-teal-600 text-white dark:bg-teal-500',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
};
```

---

## Tables

```tsx
import { table } from '../design/tokens';

<div className={table.container}>
  <table className={table.table}>
    <thead className={table.thead}>
      <tr>
        <th className={table.th}>Название</th>
        <th className={table.th}>Статус</th>
      </tr>
    </thead>
    <tbody className={table.tbody}>
      <tr className={table.tr}>
        <td className={table.td}>Элемент</td>
        <td className={table.td}>...</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## Modals

```tsx
import { modal, button } from '../design/tokens';

<div className={modal.backdrop}>
  <div className={`${modal.content} max-w-lg`}>
    <header className={modal.header}>
      <h3 className="text-xl font-bold">Заголовок</h3>
      <button>×</button>
    </header>
    <main className={modal.body}>
      {/* Content */}
    </main>
    <footer className={modal.footer}>
      <button className={`${button.base} ${button.secondary}`}>Отмена</button>
      <button className={`${button.base} ${button.primary}`}>Сохранить</button>
    </footer>
  </div>
</div>
```

---

## Cards

```tsx
import { surfaces, borders, radii, shadows, typography } from '../design/tokens';

<div className={`${surfaces.card} ${borders.default} border ${radii.card} ${shadows.card} p-6`}>
  <h2 className={typography.h2}>Card Title</h2>
  <p className={typography.body}>Card content...</p>
</div>
```

---

## Form Inputs

```tsx
import { input } from '../design/tokens';

<div>
  <label className={input.label}>Название</label>
  <input type="text" className={input.base} />
</div>

<div>
  <label className={input.label}>Тип</label>
  <select className={input.select}>
    <option value="">Выберите...</option>
  </select>
</div>
```

---

## Dark Mode

Все токены уже включают `dark:` варианты. Tailwind настроен на `darkMode: 'class'`.

```tsx
// Toggle dark mode
document.documentElement.classList.toggle('dark');
```

---

## Migration Checklist

При обновлении компонента:

- [ ] Заменить inline colors на `statusBadge.*`
- [ ] Заменить card styles на `surfaces.card + radii.card + shadows.card`
- [ ] Заменить button inline на `button.base + button.[variant]`
- [ ] Заменить table inline на `table.*`
- [ ] Проверить dark mode
