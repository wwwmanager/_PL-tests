$ErrorActionPreference = "Stop"

Write-Host "Starting download..."

$downloadDir = "$env:TEMP\prisma-engines-download"
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"

if (!(Test-Path $downloadDir)) { New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null }
if (!(Test-Path $cacheDir)) { New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null }

$files = @(
    "query_engine-windows.dll.node",
    "schema-engine-windows.exe"
)

$baseUrl = "https://github.com/prisma/prisma-engines/releases/download/5.22.0"

foreach ($file in $files) {
    $url = "$baseUrl/$file.gz"
    $gzPath = "$downloadDir\$file.gz"
    $extractedPath = "$downloadDir\$file"
    
    Write-Host "Downloading $file ..."
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $gzPath -UseBasicParsing
        
        $inputStream = [System.IO.File]::OpenRead($gzPath)
        $outputStream = [System.IO.File]::Create($extractedPath)
        $gzipStream = New-Object System.IO.Compression.GzipStream($inputStream, [System.IO.Compression.CompressionMode]::Decompress)
        
        $gzipStream.CopyTo($outputStream)
        
        $gzipStream.Close()
        $outputStream.Close()
        $inputStream.Close()
        
        Move-Item -Path $extractedPath -Destination "$cacheDir\$file" -Force
        Write-Host "Success: $file"
    }
    catch {
        Write-Host "Error downloading $file"
        Write-Host $_
    }
}
