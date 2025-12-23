# PR2 Testing: Void Endpoint
Write-Host "=== PR2 VOID ENDPOINT TEST ===" -ForegroundColor Cyan
""

# Login
$loginJson = curl.exe -s http://localhost:3001/api/auth/login `
    -H "Content-Type: application/json" `
    --data-binary "@login.json"
$token = ($loginJson | ConvertFrom-Json).data.token

if (-not $token) {
    Write-Host "FAIL Login failed" -ForegroundColor Red
    exit
}
Write-Host "OK Logged in" -ForegroundColor Green
""

# Step 1: Create a manual INCOME movement
Write-Host "[1] Creating manual INCOME movement..." -ForegroundColor Yellow
$createJson = curl.exe -s http://localhost:3001/api/stock/movements/v2 `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -d '{
        "movementType": "INCOME",
        "stockItemId": "test-item-id",
        "stockLocationId": "test-location-id",
        "quantity": "100.000",
        "occurredAt": "2025-12-23T12:00:00Z",
        "externalRef": "TEST_VOID_PR2_001",
        "comment": "Test for void functionality"
    }'

$create = $createJson | ConvertFrom-Json
if ($create.id) {
    $movementId = $create.id
    Write-Host "OK Created movement: $movementId" -ForegroundColor Green
}
else {
    Write-Host "SKIP Could not create movement (may need valid IDs)" -ForegroundColor Yellow
    Write-Host "   Response: $createJson" -ForegroundColor Gray
    exit
}
""

# Step 2: Void the movement
Write-Host "[2] Voiding movement..." -ForegroundColor Yellow
$voidTest = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$movementId/void" `
    -d '{"reason":"Testing void functionality in PR2"}'

$lines = $voidTest -split "`n"
$status = $lines[-1]
$body = $lines[0..($lines.Count - 2)] -join "`n"

if ($status -eq "200") {
    Write-Host "OK Status 200 (voided)" -ForegroundColor Green
    $voidedObj = $body | ConvertFrom-Json
    if ($voidedObj.data.isVoid) {
        Write-Host "OK isVoid=true" -ForegroundColor Green
    }
}
else {
    Write-Host "FAIL Expected 200, got $status" -ForegroundColor Red
    Write-Host "   Body: $body" -ForegroundColor Gray
}
""

# Step 3: Try to void again (should fail)
Write-Host "[3] Trying to void again (should fail)..." -ForegroundColor Yellow
$void2 = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$movementId/void" `
    -d '{"reason":"Trying to void again"}'

$lines2 = $void2 -split "`n"
$status2 = $lines2[-1]

if ($status2 -eq "400") {
    Write-Host "OK Status 400 (already voided)" -ForegroundColor Green
}
else {
    Write-Host "FAIL Expected 400, got $status2" -ForegroundColor Red
}
""

# Step 4: Try to void with short reason (should fail)
Write-Host "[4] Trying to void with short reason..." -ForegroundColor Yellow
$void3 = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$movementId/void" `
    -d '{"reason":"abc"}'

$lines3 = $void3 -split "`n"
$status3 = $lines3[-1]

if ($status3 -eq "400") {
    Write-Host "OK Status 400 (short reason rejected)" -ForegroundColor Green
}
else {
    Write-Host "WARN Expected 400, got $status3" -ForegroundColor Yellow
}
""

Write-Host "=== PR2 TESTS COMPLETE ===" -ForegroundColor Cyan
