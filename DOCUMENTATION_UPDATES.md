# Изменения для APPLICATION_CONTEXT.md

## Добавить перед строкой 180 (перед "## 6. Roadmap и приоритеты"):

```markdown
---

## 6. История важных изменений

### 2025-11-30 — Рефакторинг Driver → Employee
- **Расширены сущности Employee и Vehicle** под фронтовые типы
- **Сущность Driver удалена**, функционал полностью перенесён в Employee
- **Employee.employeeType** = 'driver' определяет водителей
- **Waybill.driver** теперь ссылается на Employee (вместо Driver)
- **Vehicle.assignedDriver** теперь ссылается на Employee (вместо Driver)
- **API endpoint** `/api/drivers` удалён, используется `/api/employees` с фильтрацией
- **База данных** пересоздана с чистой схемой
- **Seed скрипт** обновлён для создания Employee с типом 'driver'

**Результат:** Упрощённая доменная модель, полное соответствие backend и frontend типов.

---
```

## И переименовать:
- "## 6. Roadmap и приоритеты" → "## 7. Roadmap и приоритеты"
- Все последующие разделы сдвинуть на +1

## Дополнительно уточнить в разделе 3.2 (строка 78):
Текущий текст уже правильный:
```
- Employee (с типом 'driver', 'dispatcher' и др.)
```

Можно расширить до:
```
- Employee (единая сущность для всех типов сотрудников; employeeType = 'driver'/'dispatcher'/'controller' и т.д.; Waybill.driver и Vehicle.assignedDriver ссылаются на Employee)
```
