# Install Prisma Engines from ZIP
# Simple version without complex syntax

Write-Host "=== Prisma Engines Installation ===" -ForegroundColor Cyan
Write-Host ""

# Paths
$zipPath = "$env:USERPROFILE\Downloads\prisma-5.22.0.zip"
$extractPath = "$env:TEMP\prisma-extract"
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

# Check ZIP
if (-not (Test-Path $zipPath)) {
    Write-Host "ERROR: ZIP not found at $zipPath" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Found ZIP: $zipPath" -ForegroundColor Green

# Extract
Write-Host "Extracting..." -ForegroundColor Yellow
if (Test-Path $extractPath) {
    Remove-Item -Recurse -Force $extractPath
}
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
Write-Host "Extracted OK" -ForegroundColor Green

# Create cache
Write-Host "Creating cache folder..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

# Find engines
Write-Host "Finding engines..." -ForegroundColor Yellow
$allFiles = Get-ChildItem -Path $extractPath -Recurse -File
$engines = $allFiles | Where-Object { 
    ($_.Name -like "*engine*") -and (($_.Extension -eq ".exe") -or ($_.Name -like "*.node"))
}

if ($engines.Count -eq 0) {
    Write-Host "ERROR: No engines found!" -ForegroundColor Red
    Write-Host "Files in ZIP:" -ForegroundColor Yellow
    $allFiles | Select-Object Name, Extension
    pause
    exit 1
}

Write-Host "Found $($engines.Count) engines:" -ForegroundColor Green
foreach ($eng in $engines) {
    Write-Host "  - $($eng.Name)" -ForegroundColor White
}

# Copy to cache
Write-Host ""
Write-Host "Copying to cache..." -ForegroundColor Yellow
foreach ($eng in $engines) {
    $dest = Join-Path $cacheDir $eng.Name
    Copy-Item -Force $eng.FullName $dest
    Write-Host "  Copied: $($eng.Name)" -ForegroundColor Green
}

# Cleanup
Remove-Item -Recurse -Force $extractPath

Write-Host ""
Write-Host "SUCCESS! Engines installed" -ForegroundColor Green
Write-Host ""
Write-Host "Location: $cacheDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  cd C:\_PL-tests\backend" -ForegroundColor White
Write-Host "  npx prisma generate" -ForegroundColor White
Write-Host ""

pause
