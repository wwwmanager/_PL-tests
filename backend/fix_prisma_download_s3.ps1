$ErrorActionPreference = "Stop"

Write-Host "Starting download from S3..."

$downloadDir = "$env:TEMP\prisma-engines-download"
$cacheDir = "$env:LOCALAPPDATA\Prisma\cache\5.22.0"
$commit = "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
$baseUrl = "https://binaries.prisma.sh/all_commits/$commit/windows"

if (!(Test-Path $downloadDir)) { New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null }
if (!(Test-Path $cacheDir)) { New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null }

$engines = @{
    "query_engine"         = "query_engine.dll.node";
    "schema_engine"        = "schema-engine.exe";
    "migration_engine"     = "migration-engine.exe";
    "introspection_engine" = "introspection-engine.exe";
    "fmt_engine"           = "prisma-fmt.exe"
}

foreach ($key in $engines.Keys) {
    $filename = $engines[$key]
    $url = "$baseUrl/$filename.gz"
    $gzPath = "$downloadDir\$filename.gz"
    $extractedPath = "$downloadDir\$filename"
    
    Write-Host "Downloading $filename from $url ..."
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $gzPath -UseBasicParsing
        
        $inputStream = [System.IO.File]::OpenRead($gzPath)
        $outputStream = [System.IO.File]::Create($extractedPath)
        $gzipStream = New-Object System.IO.Compression.GzipStream($inputStream, [System.IO.Compression.CompressionMode]::Decompress)
        
        $gzipStream.CopyTo($outputStream)
        
        $gzipStream.Close()
        $outputStream.Close()
        $inputStream.Close()
        
        # Prisma expects files to be named somewhat specifically in the cache sometimes, 
        # but usually it looks for the specific file logic. 
        # For cache, it often uses simpler names or just the file.
        # Let's verify the target name. Usually it's just the file name.
        
        Move-Item -Path $extractedPath -Destination "$cacheDir\$filename" -Force
        Write-Host "Success: $filename"
    }
    catch {
        Write-Host "Error downloading $filename"
        Write-Host $_
    }
}

Get-ChildItem $cacheDir
