# Simple inline test for void endpoint
Write-Host "=== PR2 Void Endpoint Test ===" -ForegroundColor Cyan
""

# Login inline
Write-Host "[1] Login..." -ForegroundColor Yellow
$loginResponse = curl.exe -s http://localhost:3001/api/auth/login `
    -H "Content-Type: application/json" `
    -d '{"email":"admin@waybills.local","password":"123"}'

$loginData = $loginResponse | ConvertFrom-Json
$token = $loginData.data.token

if (-not $token) {
    Write-Host "FAIL: Login failed" -ForegroundColor Red
    Write-Host "Response: $loginResponse" -ForegroundColor Gray
    exit 1
}
Write-Host "OK: Logged in" -ForegroundColor Green
""

# Get a manual movement
Write-Host "[2] Get manual movement..." -ForegroundColor Yellow
$movementsResponse = curl.exe -s -H "Authorization: Bearer $token" http://localhost:3001/api/stock/movements
$movements = ($movementsResponse | ConvertFrom-Json).data
$manual = $movements | Where-Object { $null -eq $_.documentType -and -not $_.isVoid } | Select-Object -First 1

if (-not $manual) {
    Write-Host "SKIP: No manual movements" -ForegroundColor Yellow
    exit 0
}

$movId = $manual.id
Write-Host "OK: Using movement $movId" -ForegroundColor Green
""

# TEST: Void movement
Write-Host "[3] Void movement..." -ForegroundColor Yellow
$voidResponse = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$movId/void" `
    -d '{"reason":"PR2 final test"}'

$lines = $voidResponse -split "`n"
$status = $lines[-1]
$body = ($lines[0..($lines.Count - 2)] -join "`n")

Write-Host "Status: $status" -ForegroundColor $(if ($status -eq "200") { "Green" } else { "Red" })
Write-Host "Body:" -ForegroundColor Gray
Write-Host $body -ForegroundColor Gray
""

Write-Host "=== TEST RESULTS ===" -ForegroundColor Cyan
Write-Host "Void status: $status (expected: 200)"
Write-Host "Success: $(if ($status -eq '200') {'YES'} else {'NO'})"
