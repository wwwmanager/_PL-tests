# Правильная ссылка на Prisma Engines 5.22.0

## Проблема
Скачанный ZIP не содержит engines или содержит неправильные файлы.

## Правильный способ скачать engines

### Вариант 1: Прямая ссылка на GitHub (РЕКОМЕНДУЕТСЯ)

Откройте эти ссылки в браузере и скачайте:

**Для Windows x64:**

1. **Query Engine** (самый важный):
   ```
   https://github.com/prisma/prisma-engines/releases/download/5.22.0/query-engine-windows.dll.node.gz
   ```

2. **Schema Engine**:
   ```
   https://github.com/prisma/prisma-engines/releases/download/5.22.0/schema-engine-windows.exe.gz
   ```

**Сохраните  в `C:\Users\User\Downloads\`**

---

### Вариант 2: PowerShell скрипт для автоматического скачивания

Создайте файл `download-engines.ps1`:

```powershell
# Download Prisma Engines 5.22.0 for Windows

$downloadDir = "$env:USERPROFILE\Downloads\prisma-engines"
New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null

$baseUrl = "https://github.com/prisma/prisma-engines/releases/download/5.22.0"

$files = @(
    "query-engine-windows.dll.node.gz",
    "schema-engine-windows.exe.gz"
)

Write-Host "Downloading Prisma Engines 5.22.0..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $files) {
    $url = "$baseUrl/$file"
    $output = "$downloadDir\$file"
    
    Write-Host "Downloading: $file" -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
        Write-Host "  OK: $file" -ForegroundColor Green
    } catch {
        Write-Host "  FAILED: $file" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor DarkRed
    }
}

Write-Host ""
Write-Host "Download complete!" -ForegroundColor Green
Write-Host "Files saved to: $downloadDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: Run install-downloaded-engines.ps1" -ForegroundColor Yellow
pause
```

Запустите:
```powershell
.\download-engines.ps1
```

---

### Шаг 2: Установка скачанных engines

Создайте файл `install-downloaded-engines.ps1`:

```powershell
# Install manually downloaded Prisma engines

$downloadDir = "$env:USERPROFILE\Downloads\prisma-engines"
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

Write-Host "Installing Prisma Engines..." -ForegroundColor Cyan
Write-Host ""

# Create cache directory
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

# Files to process
$engines = @{
    "query-engine-windows.dll.node.gz" = "query_engine-windows.dll.node"
    "schema-engine-windows.exe.gz" = "schema-engine-windows.exe"
}

foreach ($gz in $engines.Keys) {
    $gzPath = "$downloadDir\$gz"
    $targetName = $engines[$gz]
    $targetPath = "$cacheDir\$targetName"
    
    if (-not (Test-Path $gzPath)) {
        Write-Host "Missing: $gz" -ForegroundColor Red
        continue
    }
    
    Write-Host "Extracting: $gz" -ForegroundColor Yellow
    
    # Extract .gz file
    $gzStream = New-Object System.IO.FileStream($gzPath, [System.IO.FileMode]::Open)
    $outStream = New-Object System.IO.FileStream($targetPath, [System.IO.FileMode]::Create)
    $gzip = New-Object System.IO.Compression.GzipStream($gzStream, [System.IO.Compression.CompressionMode]::Decompress)
    
    $gzip.CopyTo($outStream)
    
    $gzip.Close()
    $outStream.Close()
    $gzStream.Close()
    
    Write-Host "  Installed: $targetName" -ForegroundColor Green
}

Write-Host ""
Write-Host "SUCCESS!" -ForegroundColor Green
Write-Host "Engines installed to: $cacheDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installed files:" -ForegroundColor Yellow
Get-ChildItem $cacheDir | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  $($_.Name) - $sizeMB MB" -ForegroundColor White
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  cd C:\_PL-tests\backend" -ForegroundColor White
Write-Host "  npx prisma generate" -ForegroundColor White
Write-Host ""

pause
```

Запустите:
```powershell
.\install-downloaded-engines.ps1
```

---

## Быстрый вариант: Все в одном скрипте

Создайте `get-prisma-engines.ps1`:

```powershell
# Download and Install Prisma 5.22.0 Engines - All in One

$ErrorActionPreference = "Stop"

Write-Host "=== Prisma 5.22.0 Engines Setup ===" -ForegroundColor Cyan
Write-Host ""

$tempDir = "$env:TEMP\prisma-download"
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

$baseUrl = "https://github.com/prisma/prisma-engines/releases/download/5.22.0"

$engines = @{
    "query-engine-windows.dll.node.gz" = "query_engine-windows.dll.node"
    "schema-engine-windows.exe.gz" = "schema-engine-windows.exe"
}

foreach ($gzFile in $engines.Keys) {
    $url = "$baseUrl/$gzFile"
    $gzPath = "$tempDir\$gzFile"
    $targetName = $engines[$gzFile]
    $targetPath = "$cacheDir\$targetName"
    
    Write-Host "Downloading: $gzFile" -ForegroundColor Yellow
    Invoke-WebRequest -Uri $url -OutFile $gzPath -UseBasicParsing
    Write-Host "  Downloaded" -ForegroundColor Green
    
    Write-Host "Extracting: $gzFile" -ForegroundColor Yellow
    $gzStream = [System.IO.File]::OpenRead($gzPath)
    $outStream = [System.IO.File]::Create($targetPath)
    $gzip = New-Object System.IO.Compression.GzipStream($gzStream, [System.IO.Compression.CompressionMode]::Decompress)
    
    $gzip.CopyTo($outStream)
    
    $gzip.Close()
    $outStream.Close()
    $gzStream.Close()
    
    Write-Host "  Installed: $targetName" -ForegroundColor Green
}

Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "SUCCESS! Engines ready" -ForegroundColor Green
Write-Host "Location: $cacheDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: npx prisma generate" -ForegroundColor Yellow
Write-Host ""

pause
```

**Запустите:**
```powershell
cd C:\_PL-tests\backend
.\get-prisma-engines.ps1
```

---

## После установки

Проверьте, что engines установлены:

```powershell
# Проверить файлы
Get-ChildItem "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

# Должны увидеть:
# query_engine-windows.dll.node (~20-30 MB)
# schema-engine-windows.exe (~20-30 MB)
```

Затем:
```powershell
cd C:\_PL-tests\backend
npx prisma generate
```

Если все ок, должно появиться:
```
Prisma schema loaded from prisma\schema.prisma
✔ Generated Prisma Client (5.22.0) to .\node_modules\@prisma\client
```

---

## Troubleshooting

### Если GitHub тоже заблокирован

Используйте VPN:
- ProtonVPN (бесплатно)
- Cloudflare WARP (бесплатно)
- Любой другой

Или попросите кого-то скачать и передать файлы.

### Правильные имена файлов в кэше

```
query_engine-windows.dll.node  (не query-engine!)
schema-engine-windows.exe
```

Обратите внимание на `_` вместо `-` в query_engine!
