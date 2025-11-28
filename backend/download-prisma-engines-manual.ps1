# ЭКСТРЕННОЕ РЕШЕНИЕ: Ручная загрузка Prisma Engines

## Проблема
`binaries.prisma.sh` недоступен (провайдер блокирует или нестабильное соединение).

**Ошибка:**
```
Error: request to https://binaries.prisma.sh/... failed, reason: read ECONNRESET
```

## Решение: Скачать engines вручную

### Шаг 1: Определить нужную версию

Для Prisma **5.22.0** нужен commit: `605197351a3c8bdd595af2d2a9bc3025bca48ea2`

### Шаг 2: Скачать файлы

Откройте PowerShell и выполните:

```powershell
# Создать временную папку для загрузки
$downloadDir = "$env:TEMP\prisma-engines"
New-Item -ItemType Directory -Force -Path $downloadDir

# Commit hash для Prisma 5.22.0
$commitHash = "605197351a3c8bdd595af2d2a9bc3025bca48ea2"

# URLs для скачивания (с GitHub Releases)
$baseUrl = "https://github.com/prisma/prisma-engines/releases/download/5.22.0"

# Альтернативный URL (если первый не работает)
# $baseUrl = "https://binaries.prisma.sh/all_commits/$commitHash/windows"

$files = @(
    "query_engine-windows.dll.node",
    "schema-engine-windows.exe",
    "migration-engine-windows.exe",
    "introspection-engine-windows.exe"
)

# Скачать каждый файл
foreach ($file in $files) {
    $url = "$baseUrl/$file.gz"
    $outputFile = "$downloadDir\$file.gz"
    
    Write-Host "Downloading $file..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $url -OutFile $outputFile -UseBasicParsing
        Write-Host "✓ Downloaded: $file" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Failed to download $file" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Yellow
    }
}

Write-Host "`nDownload completed!" -ForegroundColor Green
Write-Host "Files saved to: $downloadDir" -ForegroundColor Cyan
```

### Шаг 3: Распаковать файлы

```powershell
# Продолжение предыдущего скрипта
Write-Host "`nExtracting files..." -ForegroundColor Cyan

foreach ($file in $files) {
    $gzFile = "$downloadDir\$file.gz"
    $outputFile = "$downloadDir\$file"
    
    if (Test-Path $gzFile) {
        Write-Host "Extracting $file..." -ForegroundColor Yellow
        
        # Использовать встроенный .NET для распаковки gzip
        $input = New-Object System.IO.FileStream $gzFile, ([IO.FileMode]::Open), ([IO.FileAccess]::Read), ([IO.FileShare]::Read)
        $output = New-Object System.IO.FileStream $outputFile, ([IO.FileMode]::Create), ([IO.FileAccess]::Write), ([IO.FileShare]::None)
        $gzipStream = New-Object System.IO.Compression.GzipStream $input, ([IO.Compression.CompressionMode]::Decompress)
        
        $gzipStream.CopyTo($output)
        
        $gzipStream.Close()
        $output.Close()
        $input.Close()
        
        Write-Host "✓ Extracted: $file" -ForegroundColor Green
    }
}
```

### Шаг 4: Переместить в кэш Prisma

```powershell
# Создать папку кэша для версии 5.22.0
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"
New-Item -ItemType Directory -Force -Path $cacheDir

Write-Host "`nMoving engines to Prisma cache..." -ForegroundColor Cyan

foreach ($file in $files) {
    $sourceFile = "$downloadDir\$file"
    $destFile = "$cacheDir\$file"
    
    if (Test-Path $sourceFile) {
        Copy-Item -Path $sourceFile -Destination $destFile -Force
        Write-Host "✓ Moved: $file" -ForegroundColor Green
    }
}

Write-Host "`nCleanup..." -ForegroundColor Cyan
Remove-Item -Path $downloadDir -Recurse -Force

Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
Write-Host "Engines installed to: $cacheDir" -ForegroundColor Cyan
Write-Host "`nNow run:" -ForegroundColor Yellow
Write-Host "  cd C:\_PL-tests\backend" -ForegroundColor White
Write-Host "  npx prisma generate" -ForegroundColor White
```

### Полный скрипт (одной командой)

Сохраните как `download-prisma-engines-manual.ps1`:

```powershell
# Полный скрипт загрузки Prisma Engines вручную
$ErrorActionPreference = "Stop"

Write-Host "=== Prisma Engines Manual Download ===" -ForegroundColor Cyan
Write-Host ""

# Параметры
$commitHash = "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
$downloadDir = "$env:TEMP\prisma-engines-download"
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

# Создать временную папку
New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

# Список файлов
$engines = @{
    "query_engine"  = "query_engine-windows.dll.node"
    "schema_engine" = "schema-engine-windows.exe"
}

# URL базовый (попробуем GitHub Releases)
$githubBaseUrl = "https://github.com/prisma/prisma-engines/releases/download/5.22.0"

# Скачивание
foreach ($engine in $engines.GetEnumerator()) {
    $fileName = $engine.Value
    $url = "$githubBaseUrl/$fileName.gz"
    $gzPath = "$downloadDir\$fileName.gz"
    $extractedPath = "$downloadDir\$fileName"
    
    Write-Host "Downloading $fileName..." -ForegroundColor Yellow
    
    try {
        # Скачать .gz файл
        Invoke-WebRequest -Uri $url -OutFile $gzPath -UseBasicParsing -ErrorAction Stop
        
        # Распаковать
        $gzStream = New-Object System.IO.FileStream $gzPath, ([IO.FileMode]::Open)
        $outStream = New-Object System.IO.FileStream $extractedPath, ([IO.FileMode]::Create)
        $gzip = New-Object System.IO.Compression.GzipStream $gzStream, ([IO.Compression.CompressionMode]::Decompress)
        
        $gzip.CopyTo($outStream)
        
        $gzip.Close()
        $outStream.Close()
        $gzStream.Close()
        
        # Переместить в кэш
        $cachePath = "$cacheDir\$fileName"
        Move-Item -Path $extractedPath -Destination $cachePath -Force
        
        Write-Host "✓ $fileName installed" -ForegroundColor Green
        
    }
    catch {
        Write-Host "✗ Failed: $fileName" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor DarkRed
    }
}

# Очистка
Remove-Item -Path $downloadDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host "Engines location: $cacheDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  cd C:\_PL-tests\backend" -ForegroundColor White
Write-Host "  npx prisma generate" -ForegroundColor White
Write-Host ""
```

## Альтернатива: Использовать в offline режиме

Если скачивание все равно не работает, используйте уже установленные engines:

```powershell
cd C:\_PL-tests\backend

# Установить переменную окружения
$env:PRISMA_SKIP_DOWNLOAD = "true"

# Сгенерировать клиент
npx prisma generate

# Или добавить в .env
echo "PRISMA_SKIP_DOWNLOAD=true" >> .env
```

## Проверка

После установки проверьте:

```powershell
# Проверить наличие файлов
Get-ChildItem "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

# Должны увидеть:
# query_engine-windows.dll.node
# schema-engine-windows.exe

# Попробовать сгенерировать
cd C:\_PL-tests\backend
npx prisma generate
```

## Если ничего не помогает: использовать VPN

Если провайдер блокирует GitHub и Prisma CDN:

1. Установить бесплатный VPN (например, ProtonVPN)
2. Подключиться к серверу в другой стране
3. Выполнить `npm install` снова
4. Отключить VPN после установки

-- -

* * Рекомендация:** Попробуйте сначала исправить версии пакетов (удалить @prisma/engines@7.0.1), потом это решение если не поможет.
