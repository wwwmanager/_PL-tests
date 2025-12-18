# =============================================================================
# Alternative: Use preinstalled engines or skip download
# Run this in regular PowerShell (no admin needed)
# =============================================================================

Write-Host "Attempting to use Prisma with binary targets..." -ForegroundColor Cyan
Write-Host ""

# Set environment variable to use native binaries
$env:PRISMA_CLI_BINARY_TARGETS = "native"
$env:PRISMA_QUERY_ENGINE_LIBRARY = "native"

# Try to generate with existing local engines or without download
Write-Host "Trying to generate Prisma Client without downloading engines..." -ForegroundColor Yellow
Write-Host ""

# Check if engines already exist
$queryEnginePath = "node_modules\.prisma\client\query_engine-windows.dll.node"
$schemaEnginePath = "node_modules\@prisma\engines\schema-engine-windows.exe"

if (Test-Path $queryEnginePath) {
    Write-Host "Query engine already exists at: $queryEnginePath" -ForegroundColor Green
}
else {
    Write-Host "Query engine not found at: $queryEnginePath" -ForegroundColor Yellow
}

if (Test-Path $schemaEnginePath) {
    Write-Host "Schema engine already exists at: $schemaEnginePath" -ForegroundColor Green
}
else {
    Write-Host "Schema engine not found at: $schemaEnginePath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Running npx prisma generate..." -ForegroundColor Cyan
Write-Host ""

# Try generate
try {
    npx prisma generate
    Write-Host ""
    Write-Host "SUCCESS!" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "Failed. Trying alternative approach..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try with postinstall disabled
    $env:PRISMA_SKIP_POSTINSTALL_GENERATE = "1"
    npx prisma generate
}

Write-Host ""
pause
