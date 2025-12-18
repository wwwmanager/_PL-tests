# Инструкция по ручному скачиванию Prisma Engines

## Проблема
У вас заблокированы HTTPS-соединения к binaries.prisma.sh на системном уровне.
Это может быть:
- Антивирус с SSL Inspection (Kaspersky, ESET, Dr.Web)
- Корпоративный firewall/прокси
- Windows Firewall блокирует TLS-соединения

## Решение: Ручное скачивание через браузер

### Шаг 1: Скачайте файлы engines через браузер

Откройте в браузере и скачайте ОБА файла:

1. **Query Engine:**
   https://binaries.prisma.sh/all_commits/f09f2815f091dbba658cdcd2264306d88bb5bda6/windows/query_engine.dll.node.gz

2. **Schema Engine:**
   https://binaries.prisma.sh/all_commits/f09f2815f091dbba658cdcd2264306d88bb5bda6/windows/schema-engine.exe.gz

Сохраните их в папку `C:\_PL-tests\backend\engines_temp\`

### Шаг 2: Распакуйте .gz файлы

Используйте 7-Zip или WinRAR для распаковки .gz файлов:
- `query_engine.dll.node.gz` → `query_engine.dll.node`
- `schema-engine.exe.gz` → `schema-engine.exe`

### Шаг 3: Скопируйте файлы в нужные места

Создайте папки и скопируйте файлы:

```powershell
# Создать папки если их нет
New-Item -ItemType Directory -Force -Path "node_modules\.prisma\client"
New-Item -ItemType Directory -Force -Path "node_modules\prisma"

# Скопировать query engine
Copy-Item "engines_temp\query_engine.dll.node" "node_modules\.prisma\client\query_engine-windows.dll.node"

# Скопировать schema engine  
Copy-Item "engines_temp\schema-engine.exe" "node_modules\prisma\schema-engine-windows.exe"
Copy-Item "engines_temp\schema-engine.exe" "node_modules\@prisma\engines\schema-engine-windows.exe"
```

### Шаг 4: Запустите prisma generate

После копирования файлов:

```powershell
cd C:\_PL-tests\backend
npx prisma generate
```

## Альтернатива: Отключите антивирус временно

Если у вас Kaspersky, ESET, Dr.Web или другой антивирус:

1. Найдите иконку в трее
2. Отключите на 5 минут
3. Сразу запустите: `npx prisma generate`
4. Включите антивирус обратно

Engines скачаются один раз и сохранятся в node_modules.
