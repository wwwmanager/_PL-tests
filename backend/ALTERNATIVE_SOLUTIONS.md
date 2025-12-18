# АЛЬТЕРНАТИВНОЕ РЕШЕНИЕ: Использовать engines из node_modules

## Проблема
GitHub releases не содержат файлов для 5.22.0 (404 ошибка).

## Решение 1: Скопировать из node_modules/prisma

Engines могут быть уже в папке `node_modules`:

```powershell
# Поиск engines в node_modules
Get-ChildItem -Path "node_modules" -Recurse -File | Where-Object { 
    $_.Name -like "*query*engine*" -or $_.Name -like "*schema*engine*"   
} | Select-Object FullName, Length

# Скопировать в cache
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

# Найти и скопировать
$engines = Get-ChildItem -Path "node_modules" -Recurse -File | Where-Object {
    ($_.Name -like "*query*engine*.node" -or $_.Name -like "*schema*engine*.exe") -and
    $_.Directory.Name -notlike "*test*"
}

foreach ($eng in $engines) {
    $dest = Join-Path $cacheDir $eng.Name
    Copy-Item $eng.FullName $dest -Force
    Write-Host "Copied: $($eng.Name)" -ForegroundColor Green
}
```

## Решение 2: Скачать с правильного URL (с VPN)

Правильный commit hash для Prisma 5.22.0: **605197351a3c8bdd595af2d2a9bc3025bca48ea2**

**Правильные URL:**

```
https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/windows/query_engine.dll.node.gz

https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/windows/schema-engine.exe.gz
```

⚠️ **Но у вас binaries.prisma.sh заблокирован!**

## Решение 3: Использовать engines от другого проекта

Если у вас на другом компьютере работает Prisma 5.22.0:

1. На рабочем компьютере:
```bash
npm install prisma@5.22.0
# Подождать пока скачается

# Найти engines
dir node_modules\.prisma /s /b | findstr engine
```

2. Скопировать файлы:
   - `query_engine-windows.dll.node` 
   - `schema-engine-windows.exe`

3. На этом компьютере положить в:
   `C:\Users\User\AppData\Local\Prisma\cache\5.22.0\`

## Решение 4: Скрипт для копирования из node_modules

```powershell
# copy-engines-from-node-modules.ps1

$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

Write-Host "Searching for engines in node_modules..." -ForegroundColor Cyan

# Поиск в разных местах
$searchPaths = @(
    "node_modules\prisma\node_modules\@prisma\engines",
    "node_modules\@prisma\engines",
    "node_modules\.prisma",
    "node_modules\prisma"
)

$found = $false

foreach ($path in $searchPaths) {
    if (Test-Path $path) {
        Write-Host "Checking: $path" -ForegroundColor Yellow
        
        $engines = Get-ChildItem -Path $path -Recurse -File | Where-Object {
            ($_.Name -like "query*engine*.node" -or 
             $_.Name -like "query*engine*.dll.node" -or
             $_.Name -like "schema*engine*.exe") -and
            $_.Length -gt 1MB
        }
        
        foreach ($eng in $engines) {
            $dest = Join-Path $cacheDir $eng.Name
            Copy-Item $eng.FullName $dest -Force
            $sizeMB = [math]::Round($eng.Length / 1MB, 2)
            Write-Host "  Copied: $($eng.Name) ($sizeMB MB)" -ForegroundColor Green
            $found = $true
        }
    }
}

if (-not $found) {
    Write-Host "ERROR: No engines found in node_modules!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try:" -ForegroundColor Yellow
    Write-Host "  1. Delete node_modules" -ForegroundColor White
    Write-Host "  2. Use VPN" -ForegroundColor White
    Write-Host "  3. npm install (with VPN active)" -ForegroundColor White
    Write-Host "  4. Run this script again" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "SUCCESS! Engines installed to:" -ForegroundColor Green
    Write-Host $cacheDir -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Installed:" -ForegroundColor Yellow
    Get-ChildItem $cacheDir | ForEach-Object {
        Write-Host "  $($_.Name)" -ForegroundColor White
    }
}

pause
```

## Решение 5: Скачать с зеркала/CDN

Попробуйте эти альтернативные источники:

```powershell
# jsdelivr CDN
$baseUrl = "https://cdn.jsdelivr.net/npm/@prisma/engines@5.22.0/dist"

# unpkg CDN  
$baseUrl = "https://unpkg.com/@prisma/engines@5.22.0/dist"
```

## Решение 6: Использовать VPN + npm install повторно

**Самое надежное решение:**

1. Установить бесплатный VPN:
   - ProtonVPN - https://protonvpn.com/
   - Cloudflare WARP - https://1.1.1.1/
   - Windscribe - https://windscribe.com/

2. Подключиться к VPN

3. Удалить кэш и node_modules:
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Prisma\cache"
```

4. Переустановить:
```powershell
npm install
```

5. Engines скачаются автоматически

6. Отключить VPN

## Проверка после установки

```powershell
# Проверить файлы
Get-ChildItem "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

# Должно быть минимум 2 файла:
# query_engine-windows.dll.node (~20-40 MB)
# schema-engine-windows.exe (~20-40 MB)
```

Затем:
```powershell
npx prisma generate
```

## Если ничего не помогает

Напишите мне, я могу:
1. Найти альтернативное зеркало
2. Предложить использовать Prisma 6.x или 4.x (более старые версии)
3. Помочь настроить proxy для npm
