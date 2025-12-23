# PR2 Simple Smoke Test

$ErrorActionPreference = "Continue"

Write-Host "=== PR2 VOID ENDPOINT TESTS ===" -ForegroundColor Cyan
""

# Login
$token = (curl.exe -s http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{\"email\":\"admin@waybills.local\",\"password\":\"123\"}' | ConvertFrom-Json).data.token

if (-not $token) {
    Write-Host "FAIL: Could not login" -ForegroundColor Red
    exit 1
}

# Get manual movement
$movements = (curl.exe -s -H "Authorization: Bearer $token" http://localhost:3001/api/stock/movements | ConvertFrom-Json).data
$manual = $movements | Where-Object { $null -eq $_.documentType -and -not $_.isVoid } | Select-Object -First 1

if (-not $manual) {
    Write-Host "SKIP: No manual movements to test" -ForegroundColor Yellow
    exit 0
}

$movId = $manual.id
Write-Host "Testing with movement: $movId" -ForegroundColor White
""

# Test 1: Void movement
Write-Host "[Test 1] Void movement as admin" -ForegroundColor Yellow
$response1 = curl.exe -s -w "`n%{http_code}" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -X POST "http://localhost:3001/api/stock/movements/$movId/void" -d '{\"reason\":\"PR2 smoke test\"}'
$parts1 = $response1 -split "`n"
$status1 = $parts1[-1]
$body1 = $parts1[0..($parts1.Count - 2)] -join ""

Write-Host "Status: $status1"
Write-Host "Body: $body1"
""

# Test 2: Try void again
Write-Host "[Test 2] Try to void again (should fail)" -ForegroundColor Yellow
$response2 = curl.exe -s -w "`n%{http_code}" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -X POST "http://localhost:3001/api/stock/movements/$movId/void" -d '{\"reason\":\"PR2 re-void test\"}'
$parts2 = $response2 -split "`n"
$status2 = $parts2[-1]
$body2 = $parts2[0..($parts2.Count - 2)] -join ""

Write-Host "Status: $status2"
Write-Host "Body: $body2"
""

#Test 3: Check hidden
Write-Host "[Test 3] Check movement hidden from list" -ForegroundColor Yellow
$afterList = (curl.exe -s -H "Authorization: Bearer $token" "http://localhost:3001/api/stock/movements/v2" | ConvertFrom-Json).data
$stillVisible = $afterList | Where-Object { $_.id -eq $movId }

if ($stillVisible) {
    Write-Host "FAIL: Movement still visible (should be hidden by isVoid filter)" -ForegroundColor Red
}
else {
    Write-Host "OK: Movement hidden from list" -ForegroundColor Green
}
""

Write-Host "=== RESULTS ===" -ForegroundColor Cyan
Write-Host "Test 1 (void): $status1 (expected 200)"
Write-Host "Test 2 (re-void): $status2 (expected 400)"
Write-Host "Test 3 (hidden): $(if (-not $stillVisible) {'PASS'} else {'FAIL'})"
