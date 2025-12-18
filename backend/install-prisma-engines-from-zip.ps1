# ============================================================================
# Install Prisma Engines from downloaded ZIP
# ============================================================================
# Run this after downloading prisma-5.22.0.zip to Downloads folder
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "=== Installing Prisma Engines from ZIP ===" -ForegroundColor Cyan
Write-Host ""

# Paths
$zipPath = "$env:USERPROFILE\Downloads\prisma-5.22.0.zip"
$extractPath = "$env:TEMP\prisma-engines-extract"
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"
$nodeModulesPath = "C:\_PL-tests\backend\node_modules\.prisma\client"

# Check if ZIP exists
if (-not (Test-Path $zipPath)) {
    Write-Host "ERROR: ZIP file not found at: $zipPath" -ForegroundColor Red
    Write-Host "Please download the engines first!" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Found ZIP file: $zipPath" -ForegroundColor Green

# Extract ZIP
Write-Host "Extracting ZIP..." -ForegroundColor Yellow
if (Test-Path $extractPath) {
    Remove-Item -Path $extractPath -Recurse -Force
}
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
Write-Host "✓ Extracted to: $extractPath" -ForegroundColor Green

# Create cache directory
Write-Host "`nCreating cache directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
Write-Host "✓ Cache directory ready: $cacheDir" -ForegroundColor Green

# Find engine files
Write-Host "`nLooking for engine files..." -ForegroundColor Yellow
$engineFiles = Get-ChildItem -Path $extractPath -Recurse -File | Where-Object {
    $_.Name -match "(query.*engine|schema.*engine|migration.*engine|introspection.*engine)" -and
    ($_.Extension -eq ".exe" -or $_.Extension -eq ".node" -or $_.Name -match "\.dll\.node$")
}

if ($engineFiles.Count -eq 0) {
    Write-Host "ERROR: No engine files found in ZIP!" -ForegroundColor Red
    Write-Host "ZIP contents:" -ForegroundColor Yellow
    Get-ChildItem -Path $extractPath -Recurse | Select-Object FullName
    pause
    exit 1
}

Write-Host "Found $($engineFiles.Count) engine file(s):" -ForegroundColor Green
$engineFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }

# Copy to cache
Write-Host "`nCopying engines to Prisma cache..." -ForegroundColor Yellow
foreach ($file in $engineFiles) {
    $destPath = Join-Path $cacheDir $file.Name
    Copy-Item -Path $file.FullName -Destination $destPath -Force
    Write-Host "✓ Copied: $($file.Name)" -ForegroundColor Green
}

# Also copy to node_modules if it exists
if (Test-Path "C:\_PL-tests\backend\node_modules\.prisma") {
    Write-Host "`nCopying engines to node_modules/.prisma..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $nodeModulesPath | Out-Null
    
    foreach ($file in $engineFiles) {
        $destPath = Join-Path $nodeModulesPath $file.Name
        Copy-Item -Path $file.FullName -Destination $destPath -Force
        Write-Host "✓ Copied: $($file.Name)" -ForegroundColor Green
    }
}

# Cleanup
Write-Host "`nCleaning up..." -ForegroundColor Yellow
Remove-Item -Path $extractPath -Recurse -Force
Write-Host "✓ Temporary files removed" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ SUCCESS! Engines installed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed engines:" -ForegroundColor Cyan
Get-ChildItem -Path $cacheDir | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  ✓ $($_.Name) ($sizeMB MB)" -ForegroundColor White
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. cd C:\_PL-tests\backend" -ForegroundColor White
Write-Host "  2. npx prisma generate" -ForegroundColor White
Write-Host "  3. npm run dev" -ForegroundColor White
Write-Host ""

pause
