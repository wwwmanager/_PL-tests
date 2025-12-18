# Extract engines from node_modules (if they exist)

Write-Host "=== Prisma Engines Extractor ===" -ForegroundColor Cyan
Write-Host ""

$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

Write-Host "Searching for engines in node_modules..." -ForegroundColor Yellow
Write-Host ""

# Search locations
$paths = @(
    "node_modules\prisma\node_modules\@prisma\engines",
    "node_modules\@prisma\engines", 
    "node_modules\.prisma",
    "node_modules\prisma\engines",
    "node_modules\prisma"
)

$foundEngines = @()

foreach ($path in $paths) {
    $fullPath = Join-Path (Get-Location) $path
    if (Test-Path $fullPath) {
        Write-Host "Checking: $path" -ForegroundColor Cyan
        
        $files = Get-ChildItem -Path $fullPath -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
            (($_.Name -like "*query*engine*" -and $_.Extension -eq ".node") -or
            ($_.Name -like "*query*engine*.dll.node") -or
            ($_.Name -like "*schema*engine*.exe")) -and
            $_.Length -gt 1MB
        }
        
        if ($files) {
            $foundEngines += $files
            Write-Host "  Found $($files.Count) file(s)" -ForegroundColor Green
        }
    }
}

if ($foundEngines.Count -eq 0) {
    Write-Host "ERROR: No engines found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Engines not in node_modules." -ForegroundColor Yellow
    Write-Host "You need to:" -ForegroundColor Yellow
    Write-Host "  1. Use VPN" -ForegroundColor White
    Write-Host "  2. Delete node_modules" -ForegroundColor White  
    Write-Host "  3. Run: npm install" -ForegroundColor White
    Write-Host "  4. Run this script again" -ForegroundColor White
    pause
    exit 1
}

Write-Host ""
Write-Host "Found engines:" -ForegroundColor Green
foreach ($eng in $foundEngines) {
    $sizeMB = [math]::Round($eng.Length / 1MB, 2)
    Write-Host "  $($eng.Name) - $sizeMB MB" -ForegroundColor White
}

Write-Host ""
Write-Host "Copying to cache..." -ForegroundColor Yellow

foreach ($eng in $foundEngines) {
    $dest = Join-Path $cacheDir $eng.Name
    Copy-Item -Force $eng.FullName $dest
    Write-Host "  Copied: $($eng.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "SUCCESS!" -ForegroundColor Green
Write-Host "Location: $cacheDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installed:" -ForegroundColor Yellow
Get-ChildItem $cacheDir | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  $($_.Name) - $sizeMB MB" -ForegroundColor White
}

Write-Host ""
Write-Host "Next: npx prisma generate" -ForegroundColor Yellow
Write-Host ""

pause
