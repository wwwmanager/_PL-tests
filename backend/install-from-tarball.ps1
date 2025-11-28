# Extract Prisma engines from .tar.gz archive
# Works on Windows 10+ (has built-in tar.exe)

Write-Host "=== Prisma Engines from TAR.GZ ===" -ForegroundColor Cyan
Write-Host ""

$tarPath = "$env:USERPROFILE\Downloads\prisma-5.22.0.tar.gz"
$extractPath = "$env:TEMP\prisma-tar-extract"
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

# Check tar.gz file
if (-not (Test-Path $tarPath)) {
    Write-Host "ERROR: File not found: $tarPath" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Found: $tarPath" -ForegroundColor Green
$sizeMB = [math]::Round((Get-Item $tarPath).Length / 1MB, 2)
Write-Host "Size: $sizeMB MB" -ForegroundColor Cyan
Write-Host ""

# Clean extract path
if (Test-Path $extractPath) {
    Remove-Item -Recurse -Force $extractPath
}
New-Item -ItemType Directory -Force -Path $extractPath | Out-Null

# Extract using Windows tar
Write-Host "Extracting tar.gz (this may take a minute)..." -ForegroundColor Yellow
try {
    # Windows 10+ has tar.exe
    & tar -xzf $tarPath -C $extractPath
    Write-Host "Extracted OK" -ForegroundColor Green
}
catch {
    Write-Host "ERROR extracting: $($_.Exception.Message)" -ForegroundColor Red
    pause
    exit 1
}

# Search for engines
Write-Host ""
Write-Host "Searching for engine files..." -ForegroundColor Yellow

$allFiles = Get-ChildItem -Path $extractPath -Recurse -File -ErrorAction SilentlyContinue
Write-Host "Total files extracted: $($allFiles.Count)" -ForegroundColor Cyan

$engines = $allFiles | Where-Object {
    (($_.Name -like "*query*engine*" -and ($_.Extension -eq ".node" -or $_.Name -like "*.dll.node")) -or
    ($_.Name -like "*schema*engine*" -and $_.Extension -eq ".exe")) -and
    $_.Length -gt 1MB
}

if ($engines.Count -eq 0) {
    Write-Host "ERROR: No engine files found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Looking for any executables or large files..." -ForegroundColor Yellow
    $bigFiles = $allFiles | Where-Object { $_.Length -gt 5MB } | Select-Object -First 10
    if ($bigFiles) {
        Write-Host "Large files found:" -ForegroundColor Cyan
        $bigFiles | ForEach-Object {
            $sizeMB = [math]::Round($_.Length / 1MB, 2)
            Write-Host "  $($_.Name) - $sizeMB MB" -ForegroundColor White
        }
    }
    pause
    exit 1
}

Write-Host "Found $($engines.Count) engine file(s):" -ForegroundColor Green
foreach ($eng in $engines) {
    $sizeMB = [math]::Round($eng.Length / 1MB, 2)
    Write-Host "  $($eng.Name) - $sizeMB MB" -ForegroundColor White
}

# Create cache directory
Write-Host ""
Write-Host "Installing to cache..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

# Copy engines
foreach ($eng in $engines) {
    # Fix naming: query-engine -> query_engine
    $targetName = $eng.Name -replace "query-engine", "query_engine"
    $dest = Join-Path $cacheDir $targetName
    
    Copy-Item -Force $eng.FullName $dest
    Write-Host "  Installed: $targetName" -ForegroundColor Green
}

# Cleanup
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $extractPath

Write-Host ""
Write-Host "SUCCESS! Engines installed" -ForegroundColor Green
Write-Host "Location: $cacheDir" -ForegroundColor Cyan
Write-Host ""

Write-Host "Installed engines:" -ForegroundColor Yellow
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
