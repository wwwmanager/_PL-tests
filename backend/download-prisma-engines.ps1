# Prisma Engines Manual Download Script
# Commit hash for Prisma 7.0.1
$COMMIT = "f09f2815f091dbba658cdcd2264306d88bb5bda6"
$BASE_URL = "https://binaries.prisma.sh/all_commits/$COMMIT/windows"

# Engine files needed
$engines = @(
    "query_engine.dll.node",
    "schema-engine.exe"
)

# Create directory for engines
$enginesDir = "node_modules\.prisma\client"
New-Item -ItemType Directory -Force -Path $enginesDir | Out-Null

Write-Host "Downloading Prisma engines for Windows..." -ForegroundColor Cyan

foreach ($engine in $engines) {
    $url = "$BASE_URL/$engine.gz"
    $outputGz = "$enginesDir\$engine.gz"
    $outputFile = "$enginesDir\$engine"
    
    Write-Host "Downloading $engine..." -ForegroundColor Yellow
    
    try {
        # Try using curl (available in Windows 10+)
        curl.exe -L -o $outputGz $url
        
        if (Test-Path $outputGz) {
            Write-Host "Extracting $engine..." -ForegroundColor Yellow
            
            # Use 7-Zip if available, otherwise use PowerShell
            if (Get-Command "7z.exe" -ErrorAction SilentlyContinue) {
                7z.exe e $outputGz -o"$enginesDir" -y
            } else {
                # PowerShell native gunzip
                $inputStream = New-Object System.IO.FileStream($outputGz, [System.IO.FileMode]::Open)
                $gzipStream = New-Object System.IO.Compression.GZipStream($inputStream, [System.IO.Compression.CompressionMode]::Decompress)
                $outputStream = New-Object System.IO.FileStream($outputFile, [System.IO.FileMode]::Create)
                $gzipStream.CopyTo($outputStream)
                $outputStream.Close()
                $gzipStream.Close()
                $inputStream.Close()
            }
            
            # Remove .gz file
            Remove-Item $outputGz -Force
            
            Write-Host "Downloaded and extracted $engine" -ForegroundColor Green
        }
    } catch {
        Write-Host "Failed to download $engine : $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done! Now try running: npx prisma generate" -ForegroundColor Cyan
