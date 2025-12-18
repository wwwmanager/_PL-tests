# Диагностический отчёт: Prisma Engine Download Failure

## 📊 Информация о системе

**Операционная система:**
- Windows 10 Build 19045 (Windows 10 21H2)

**Node.js & NPM:**
- Node.js: v20.19.5
- NPM: 10.8.2

**Prisma:**
- @prisma/client: ^7.0.1
- prisma: ^7.0.1
- @prisma/engines: ^7.0.1
- Engine commit: f09f2815f091dbba658cdcd2264306d88bb5bda6

## ❌ Точный текст ошибки

```
> Downloading Prisma engines for windows [                    ] 0%
Error: request to https://binaries.prisma.sh/all_commits/f09f2815f091dbba658cdcd2264306d88bb5bda6/windows/schema-engine.exe.sha256 failed, reason: Client network socket disconnected before secure TLS connection was established
```

## 🔍 Диагностика проблемы

### Проверенные факторы:

✅ **Сетевое подключение**: Ping работает (75ms)  
✅ **TCP соединение**: Порт 443 доступен (Test-NetConnection успешен)  
✅ **DNS резолвинг**: binaries.prisma.sh → 172.66.156.100 (Cloudflare)  
❌ **TLS handshake**: Fails на уровне Node.js  
❌ **curl.exe**: Также получает "Connection was reset"  

### Причина:

**Windows Firewall блокирует исходящие TLS-соединения** для приложений в режиме "Общедоступная сеть" (Public Network).

## 🎯 Рабочие решения (по приоритету)

### Решение 1: Скачать Prisma engines через браузер (100% работает)

Этот метод обходит проблему с firewall, т.к. браузер уже разрешён.

#### Шаг 1: Скачайте файлы

Откройте в браузере и скачайте:

1. **Query Engine:**
   ```
   https://binaries.prisma.sh/all_commits/f09f2815f091dbba658cdcd2264306d88bb5bda6/windows/query_engine.dll.node.gz
   ```

2. **Schema Engine:**
   ```
   https://binaries.prisma.sh/all_commits/f09f2815f091dbba658cdcd2264306d88bb5bda6/windows/schema-engine.exe.gz
   ```

Сохраните в `C:\_PL-tests\backend\engines_manual\`

#### Шаг 2: Распакуйте .gz файлы

Используйте 7-Zip, WinRAR или онлайн-сервис для распаковки:
- `query_engine.dll.node.gz` → `query_engine.dll.node`
- `schema-engine.exe.gz` → `schema-engine.exe`

#### Шаг 3: Поместите файлы в правильные папки

Выполните в PowerShell:

```powershell
cd C:\_PL-tests\backend

# Создать папки
New-Item -ItemType Directory -Force -Path "node_modules\.prisma\client"
New-Item -ItemType Directory -Force -Path "node_modules\@prisma\engines"

# Скопировать Query Engine
Copy-Item "engines_manual\query_engine.dll.node" "node_modules\.prisma\client\query_engine-windows.dll.node"

# Скопировать Schema Engine
Copy-Item "engines_manual\schema-engine.exe" "node_modules\@prisma\engines\schema-engine-windows.exe"
```

#### Шаг 4: Генерация Prisma Client

После копирования engines:

```powershell
# Установить переменную, чтобы Prisma не скачивал engines
$env:PRISMA_SKIP_POSTINSTALL_GENERATE="true"

# Генерировать клиент (engines уже есть локально)
npx prisma generate --skip-generate
```

Или просто:

```powershell
# Prisma найдёт локальные engines и не будет скачивать
npx prisma generate
```

---

### Решение 2: Изменить тип сети на "Частная"

#### Через GUI (требуется перезапуск сети):

1. **Win + I** → **Сеть и Интернет** → **Ethernet**
2. Кликните на подключение **"Сеть"**
3. **Тип сетевого профиля** → выберите **"Частный"**
4. Перезапустите PowerShell
5. Попробуйте `npx prisma generate`

#### Через PowerShell (требуются права администратора):

1. Запустите PowerShell **от имени администратора**
2. Выполните:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private
```

3. Проверьте:

```powershell
Get-NetConnectionProfile
```

4. В обычном PowerShell: `npx prisma generate`

---

### Решение 3: Добавить Node.js в исключения Firewall

#### Через PowerShell (от администратора):

```powershell
# Найти путь к node.exe
$nodePath = (Get-Command node).Path

# Добавить правило для исходящих соединений
New-NetFirewallRule -DisplayName "Node.js HTTPS Outbound" `
  -Direction Outbound `
  -Program $nodePath `
  -Protocol TCP `
  -RemotePort 443 `
  -Action Allow `
  -Profile Public

Write-Host "Node.js добавлен в исключения брандмауэра"
```

После этого: `npx prisma generate`

---

### Решение 4: Откатиться на Prisma 5.x (совместимость)

Prisma 5.x может иметь более стабильную загрузку engines:

```powershell
cd C:\_PL-tests\backend

# Откатиться на стабильную версию
npm install prisma@5.22.0 @prisma/client@5.22.0

# Попробовать generate
npx prisma generate
```

---

## 🚀 РЕКОМЕНДАЦИЯ

**Используйте Решение 1** (ручное скачивание через браузер) — это самый надёжный и быстрый способ.

После успешной установки engines, они сохранятся в `node_modules` и больше не потребуют скачивания.

---

## 📝 Следующие шаги после установки engines

1. ✅ `npx prisma generate` — генерация Prisma Client
2. ✅ `npm run prisma:migrate` — создание миграции БД
3. ✅ `npm run prisma:seed` — заполнение тестовыми данными
4. ✅ `npm run dev` — запуск backend сервера
