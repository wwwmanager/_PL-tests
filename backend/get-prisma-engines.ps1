# Download and Install Prisma 5.22.0 Engines - Simple Version
# Works if GitHub is accessible

$ErrorActionPreference = "Stop"

Write-Host "=== Prisma 5.22.0 Engines Download ===" -ForegroundColor Cyan
Write-Host ""

$tempDir = "$env:TEMP\prisma-dl"
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

# Create directories
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

$baseUrl = "https://github.com/prisma/prisma-engines/releases/download/5.22.0"

# Files to download
$downloads = @{
    "query-engine-windows.dll.node" = "query_engine-windows.dll.node"
    "schema-engine-windows.exe"     = "schema-engine-windows.exe"
}

foreach ($fileName in $downloads.Keys) {
    $gzFile = "$fileName.gz"
    $url = "$baseUrl/$gzFile"
    $gzPath = "$tempDir\$gzFile"
    $finalName = $downloads[$fileName]
    $finalPath = "$cacheDir\$finalName"
    
    Write-Host "Downloading: $gzFile" -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $url -OutFile $gzPath -UseBasicParsing
        Write-Host "  Downloaded OK" -ForegroundColor Green
    }
    catch {
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
        continue
    }
    
    Write-Host "Extracting..." -ForegroundColor Yellow
    $gzStream = [System.IO.File]::OpenRead($gzPath)
    $outStream = [System.IO.File]::Create($finalPath)
    $gzip = New-Object System.IO.Compression.GzipStream($gzStream, [System.IO.Compression.CompressionMode]::Decompress)
    
    $gzip.CopyTo($outStream)
    
    $gzip.Close()
    $outStream.Close()
    $gzStream.Close()
    
    $sizeMB = [math]::Round((Get-Item $finalPath).Length / 1MB, 2)
    Write-Host "  Installed: $finalName ($sizeMB MB)" -ForegroundColor Green
}

# Cleanup
Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "SUCCESS!" -ForegroundColor Green
Write-Host "Engines location: $cacheDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installed:" -ForegroundColor Yellow
Get-ChildItem $cacheDir | ForEach-Object {
    Write-Host "  $($_.Name)" -ForegroundColor White
}

Write-Host ""
Write-Host "Next: npx prisma generate" -ForegroundColor Yellow
Write-Host ""

pause
