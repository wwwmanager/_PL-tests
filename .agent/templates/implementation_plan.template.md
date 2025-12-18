# [Feature/Component Name] Implementation Plan

## Проблема

Краткое описание проблемы или необходимости изменений:

- Текущее состояние:
- Ожидаемое состояние:
- Почему это важно:

---

## Найденные проблемы

### 1. [Problem Name]

**Файл:** [file.ts](file:///c:/_PL-tests/path/to/file.ts#L123)

```typescript
// Проблемный код
```

**Проблема:** Описание проблемы

**Решение:** Предлагаемое решение

---

### 2. [Another Problem]

...

---

## Предлагаемые изменения

### Phase 1: [First Phase Name]

#### [MODIFY] [filename.ts](file:///c:/_PL-tests/path/to/filename.ts)

**Изменение 1:** Описание изменения (строка X)
```typescript
// Было:
old code

// Стало:
new code
```

**Обоснование:** Почему это изменение необходимо

---

#### [NEW] [newfile.ts](file:///c:/_PL-tests/path/to/newfile.ts)

**Назначение:** Описание нового файла

**Содержимое:**
```typescript
// Основная структура нового файла
```

---

#### [DELETE] [oldfile.ts](file:///c:/_PL-tests/path/to/oldfile.ts)

**Причина удаления:** Объяснение

---

### Phase 2: [Second Phase Name]

...

---

## Verification Plan

### Automated Tests

**Test 1: [Test Name]**
```bash
npm test -- specific.test.ts
```

**Ожидаемый результат:**
- ...

---

**Test 2: [Another Test]**
```bash
npm run dev
# Manual browser test
```

**Шаги:**
1. Open browser
2. Navigate to ...
3. Expected: ...

---

### Manual Verification

**Scenario 1:** Описание сценария
- Действия:
  1. ...
  2. ...
- Ожидаемый результат: ...

---

## Success Criteria

- [ ] Критерий 1
- [ ] Критерий 2
- [ ] Все тесты проходят
- [ ] Код прошел review
- [ ] Документация обновлена
- [ ] APPLICATION_CONTEXT.md обновлен (если нужно)

---

## Rollback Plan

Если что-то пойдет не так:

1. **Откатить изменения в [file]:**
   ```typescript
   // Вернуть старый код
   ```

2. **Восстановить зависимости:**
   ```bash
   npm install [старая версия]
   ```

3. **Проверить состояние:**
   ```bash
   npm run build
   npm test
   ```

---

**Создан:** YYYY-MM-DD  
**Автор:** [AI/User]  
**Статус:** Draft / In Progress / Completed
