# Руководство по тестированию Фазы 3

## 🎯 Что мы тестируем
Проверяем, что приложение правильно переключается между двумя режимами работы:
- **Режим Водителя** — работает без интернета, данные хранятся локально (IndexedDB)
- **Центральный режим** — работает через интернет, данные на сервере (PostgreSQL)

---

## ✅ Проверка перед началом

Убедитесь, что у вас запущено:
- ✅ Бэкенд: `npm run dev` в папке `backend` (порт 3001)
- ✅ Фронтенд: `npm run dev` в корне проекта (порт 5173)

---

## 📋 План тестирования

### Тест 1: Какой режим сейчас активен?

**Как проверить:**
1. Откройте браузер и зайдите на `http://localhost:5173`
2. Нажмите F12 (откроется DevTools)
3. Перейдите на вкладку "Console" (Консоль)
4. Найдите сообщение типа:
   ```
   🔗 Waybill API: appMode = "driver" → MOCK API
   ```
   или
   ```
   🔗 Waybill API: appMode = "central" → REAL BACKEND
   ```

**Что должно быть:**
- Вы увидите, какой режим сейчас включен
- По умолчанию обычно `"driver"` (режим водителя)
- Рядом будет написано, какое API используется

**Сделайте скриншот консоли**

---

### Тест 2: Найдите настройки режима

**Как проверить:**
1. В боковом меню нажмите "Администрирование"
2. Прокрутите вниз до раздела "Настройки приложения"
3. Найдите "Режим работы приложения"
4. Там должны быть 2 радио-кнопки:
   - ⚪ **Водитель (Driver Mode)** — работа без интернета
   - ⚪ **Центральный (Central Mode)** — работа через сервер

**Что должно быть:**
- Кнопки видны
- Одна из них выбрана (скорее всего "Водитель")

**Сделайте скриншот панели администрирования**

---

### Тест 3: Переключение в Центральный режим

**Как проверить:**
1. В настройках выберите **"Центральный (Central Mode)"**
2. Нажмите кнопку **"Сохранить"** внизу страницы
3. **ОБЯЗАТЕЛЬНО перезагрузите страницу** (F5 или Ctrl+R)
4. Откройте консоль (F12 → Console)
5. Проверьте сообщение

**Что должно быть:**
```
🔗 Waybill API: appMode = "central" → REAL BACKEND
```

**Сделайте скриншот консоли с новым режимом**

---

### Тест 4: Проверка работы в Центральном режиме

**Как проверить:**
1. Нажмите "Путевые листы" в меню
2. Попробуйте открыть список путевых листов
3. Откройте DevTools → вкладка **"Network"** (Сеть)
4. Посмотрите на запросы

**Что должно быть:**
- Видны HTTP-запросы к `http://localhost:3001/api/waybills`
- Данные приходят с сервера
- **ИЛИ** ошибка, если бэкенд не запущен

**Сделайте скриншот вкладки Network с запросами**

---

### Тест 5: Переключение обратно в режим Водителя

**Как проверить:**
1. Зайдите в Администрирование → Настройки
2. Выберите **"Водитель (Driver Mode)"**
3. Нажмите "Сохранить"
4. **Перезагрузите страницу** (F5)
5. Проверьте консоль

**Что должно быть:**
```
🔗 Waybill API: appMode = "driver" → MOCK API
```

**Сделайте скриншот консоли** с режимом водителя

---

### Тест 6: Проверка работы в режиме Водителя

**Как проверить:**
1. Нажмите "Путевые листы" в меню
2. Попробуйте открыть список
3. Откройте DevTools → вкладка **"Application"** → **"IndexedDB"**
4. Раскройте базу данных `waybills_db`

**Что должно быть:**
- Данные берутся из IndexedDB (локальная база)
- В Network нет запросов к серверу `localhost:3001`
- В IndexedDB видны таблицы с данными

**Сделайте скриншот IndexedDB**

---

## 🐛 Если что-то не работает

### Проблема: В консоли "⚠️ Could not load AppSettings"
**Решение:**
- IndexedDB пустая
- Импортируйте тестовые данные или создайте начальные настройки

### Проблема: Ошибка подключения в Центральном режиме
**Решение:**
- Проверьте, что бэкенд запущен: откройте `http://localhost:3001/api/health`
- Проверьте вкладку Network на ошибки
- Убедитесь, что CORS настроен правильно

### Проблема: Режим не меняется после сохранения
**Решение:**
- **Обязательно перезагружайте страницу** после сохранения
- Проверьте в DevTools → Application → IndexedDB → ключ `app_settings`, там должно быть поле `appMode`

### Проблема: Оба режима показывают MOCK API
**Решение:**
- Проверьте, что файл `services/waybillApi.ts` сохранен с последними изменениями
- Перезапустите dev-сервер: остановите (Ctrl+C) и запустите заново `npm run dev`

---

## 📊 Как понять, что всё работает правильно?

✅ **Фаза 3 успешна, если:**
1. ✅ В консоли видно правильный режим ("driver" или "central")
2. ✅ В Центральном режиме идут запросы к серверу (вкладка Network)
3. ✅ В режиме Водителя используется IndexedDB (нет запросов к серверу)
4. ✅ Режим можно переключить в панели администрирования
5. ✅ После перезагрузки страницы режим сохраняется

---

## 📝 Шаблон отчета

После тестирования заполните:

```
## Результаты тестирования Фазы 3

**Дата:** 2025-11-30
**Кто тестировал:** [Ваше имя]

### Тест 1: Проверка консоли ✅ / ❌
- Какой режим показан: [driver/central]
- Какое API выбрано: [REAL BACKEND / MOCK API]
- Скриншот: [имя файла]

### Тест 2: Панель администрирования ✅ / ❌
- Кнопки видны: [Да/Нет]
- Какой режим выбран: [Водитель/Центральный]
- Скриншот: [имя файла]

### Тест 3: Переключение режима ✅ / ❌
- Переключение сработало: [Да/Нет]
- Консоль показывает новый режим: [Да/Нет]
- Скриншот: [имя файла]

### Тест 4: Работа в Центральном режиме ✅ / ❌
- Запросы к серверу видны: [Да/Нет]
- Данные загрузились: [Да/Нет]
- Ошибки: [Нет / Описание]
- Скриншот: [имя файла]

### Тест 5: Возврат в режим Водителя ✅ / ❌
- Переключение обратно сработало: [Да/Нет]
- Консоль показывает режим водителя: [Да/Нет]
- Скриншот: [имя файла]

### Тест 6: Работа в режиме Водителя ✅ / ❌
- IndexedDB используется: [Да/Нет]
- Данные загрузились: [Да/Нет]
- Нет запросов к серверу: [Да/Нет]
- Скриншот: [имя файла]

### ИТОГО: ✅ ВСЁ РАБОТАЕТ / ❌ ЕСТЬ ПРОБЛЕМЫ

**Заметки:**
[Любые дополнительные наблюдения, найденные баги или рекомендации]
```

---

## 🚀 Что делать дальше?

**Если все тесты прошли успешно ✅:**
- ✅ Отметить Фазу 3 как ПРОВЕРЕННУЮ
- ✅ Перейти к Фазе 4 (комплексное тестирование)
- ✅ Можно добавить предупреждение при смене режима

**Если есть проблемы ❌:**
- ❌ Подробно опишите ошибки
- ❌ Проверьте реализацию в `waybillApi.ts`
- ❌ Убедитесь, что `getAppSettings()` возвращает правильные данные
- ❌ Повторите тесты после исправлений

---

**Создано:** 2025-11-30  
**Версия:** 1.0 (на русском языке)  
**Статус:** Готово к ручному тестированию


## 🎯 Objective
Verify that dynamic API selection based on `appMode` works correctly in both Central and Driver modes.

---

## ✅ Prerequisites
- ✅ Backend running: `npm run dev` in `c:\_PL-tests\backend` (port 3001)
- ✅ Frontend running: `npm run dev` in `c:\_PL-tests` (port 5173)
- ✅ Phase 3 Implementation complete (`services/waybillApi.ts` updated)

---

## 📋 Test Plan

### Test 1: Verify Current Mode in Console

**Steps:**
1. Open browser DevTools (F12)
2. Navigate to: `http://localhost:5173`
3. Open Console tab
4. Look for log message: `🔗 Waybill API: appMode = "..." → REAL BACKEND` or `MOCK API`

**Expected Result:**
- Should see appMode setting and selected API clearly displayed
- Default is likely `"driver"` → MOCK API

**Screenshot:** Take screenshot of console showing the log

---

### Test 2: Navigate to Admin Panel

**Steps:**
1. Click "Администрирование" in sidebar
2. Scroll to "Настройки приложения" section
3. Find "Режим работы" radio buttons:
   - ⚪ Водитель (Driver Mode)
   - ⚪ Центральный (Central Mode)

**Expected Result:**
- Radio buttons are visible
- One of them is selected (likely Driver Mode)

**Screenshot:** Take screenshot of Admin settings showing mode selection

---

### Test 3: Switch to Central Mode

**Steps:**
1. In Admin panel, click "Центральный (Central Mode)" radio button
2. Click "Сохранить" (Save) button
3. **Reload the page** (F5)
4. Open Console again
5. Look for log message showing new mode

**Expected Result:**
```
🔗 Waybill API: appMode = "central" → REAL BACKEND
```

**Screenshot:** Console showing Central mode selected

---

### Test 4: Test Waybill Operations in Central Mode

**Steps:**
1. Click "Путевые листы" in sidebar
2. Try to load waybills list
3. Open Console and check for:
   - API requests to `http://localhost:3001/api/waybills`
   - No IndexedDB operations

**Expected Result:**
- Network tab shows HTTP requests to backend
- Data comes from PostgreSQL (if backend is running)
- OR Error if backend is not accessible

**Screenshot:** Network tab showing backend API calls

---

### Test 5: Switch Back to Driver Mode

**Steps:**
1. Go to Admin → Settings
2. Select "Водитель (Driver Mode)"
3. Save and reload page
4. Check console

**Expected Result:**
```
🔗 Waybill API: appMode = "driver" → MOCK API
```

**Screenshot:** Console showing Driver mode selected

---

### Test 6: Test Waybill Operations in Driver Mode

**Steps:**
1. Click "Путевые листы" in sidebar
2. Try to load waybills list
3. Open DevTools → Application → IndexedDB
4. Check for IndexedDB operations

**Expected Result:**
- Data loaded from IndexedDB
- No HTTP requests to backend in Network tab
- IndexedDB shows `waybills_db` database

**Screenshot:** Application tab showing IndexedDB data

---

## 🐛 Troubleshooting

### Issue: Console shows "⚠️ Could not load AppSettings"
**Solution:** 
- IndexedDB might be empty
- Try importing test data or creating initial settings

### Issue: Backend connection error in Central mode
**Solution:**
- Check backend is running: `http://localhost:3001/api/health`
- Verify CORS settings
- Check network tab for error details

### Issue: Mode doesn't change after save
**Solution:**
- Ensure page is reloaded after saving settings
- Check IndexedDB → `app_settings` key for `appMode` value

### Issue: Both modes show MOCK API
**Solution:**
- Check `services/waybillApi.ts` file has latest changes
- Rebuild frontend: Stop dev server and restart

---

## 📊 Success Criteria

✅ **Phase 3 is SUCCESSFUL if:**
1. Console logs show correct appMode ("driver" or "central")
2. Central mode uses backend API (Network requests visible)
3. Driver mode uses IndexedDB (no backend requests)
4. Mode can be switched in Admin panel
5. Changes persist after page reload

---

## 📝 Report Template

After testing, fill in this template:

```
## Phase 3 Testing Results

**Date:** 2025-11-30
**Tester:** [Your Name]

### Test 1: Console Log ✅ / ❌
- Mode shown: [driver/central]
- API selected: [REAL BACKEND / MOCK API]
- Screenshot: [filename]

### Test 2: Admin Panel ✅ / ❌
- Radio buttons visible: [Yes/No]
- Current selection: [Driver/Central]
- Screenshot: [filename]

### Test 3: Mode Switch ✅ / ❌
- Switch successful: [Yes/No]
- Console shows new mode: [Yes/No]
- Screenshot: [filename]

### Test 4: Central Mode Operations ✅ / ❌
- Backend requests visible: [Yes/No]
- Data loaded: [Yes/No]
- Errors: [None / Description]
- Screenshot: [filename]

### Test 5: Driver Mode Return ✅ / ❌
- Switch back successful: [Yes/No]
- Console shows driver mode: [Yes/No]
- Screenshot: [filename]

### Test 6: Driver Mode Operations ✅ / ❌
- IndexedDB operations visible: [Yes/No]
- Data loaded: [Yes/No]
- No backend requests: [Yes/No]
- Screenshot: [filename]

### Overall Result: ✅ PASS / ❌ FAIL

**Notes:**
[Any additional observations, bugs found, or recommendations]
```

---

## 🚀 Next Steps After Testing

**If tests PASS:**
- ✅ Mark Phase 3 as VERIFIED
- ✅ Proceed to Phase 4
- ✅ Consider adding mode switch warning dialog

**If tests FAIL:**
- ❌ Document errors
- ❌ Check implementation in `waybillApi.ts`
- ❌ Verify `getAppSettings()` returns correct data
- ❌ Re-test after fixes

---

**Created:** 2025-11-30  
**Version:** 1.0  
**Status:** Ready for Manual Testing
