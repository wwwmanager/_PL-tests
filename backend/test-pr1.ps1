# PR1 Sanity Test using JSON files
Write-Host "=== PR1 SANITY TEST ===" -ForegroundColor Cyan
""

# Login
Write-Host "[1] Login..." -ForegroundColor Yellow
$response = curl.exe -s http://localhost:3001/api/auth/login `
    -H "Content-Type: application/json" `
    --data-binary "@login.json"

$responseObj = $response | ConvertFrom-Json
$token = $responseObj.data.token
if ($token) {
    Write-Host "OK Got token" -ForegroundColor Green
}
else {
    Write-Host "FAIL No token in response" -ForegroundColor Red
    exit
}
""

# Test 1
Write-Host "[2] POST /api/stock/movements (legacy) -> 410" -ForegroundColor Yellow  
$test1 = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST http://localhost:3001/api/stock/movements `
    -d "{}"

$lines = $test1 -split "`n"
if ($lines[-1] -eq "410") {
    Write-Host "OK Status 410 Gone" -ForegroundColor Green
}
else {
    Write-Host "FAIL Expected 410, got $($lines[-1])" -ForegroundColor Red
}
""

# Test 2  
Write-Host "[3] DELETE /api/stock/movements/:id -> 403/405" -ForegroundColor Yellow
$movs = curl.exe -s -H "Authorization: Bearer $token" http://localhost:3001/api/stock/movements
$id = (($movs | ConvertFrom-Json).data[0]).id

if ($id) {
    $test2 = curl.exe -s -w "`n%{http_code}" `
        -H "Authorization: Bearer $token" `
        -X DELETE "http://localhost:3001/api/stock/movements/$id"
    
    $lines = $test2 -split "`n"
    $status = $lines[-1]
    if ($status -eq "403" -or $status -eq "405") {
        Write-Host "OK Status $status (blocked)" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL Expected 403/405, got $status" -ForegroundColor Red
    }
}
else {
    Write-Host "SKIP No movements" -ForegroundColor Yellow
}
""

# Test 3
Write-Host "[4] PUT /api/stock/movements/:id (system) -> 400" -ForegroundColor Yellow
$movsObj = $movs | ConvertFrom-Json
$sysId = ($movsObj.data | Where-Object { $_.documentType } | Select-Object -First 1).id

if ($sysId) {
    $test3 = curl.exe -s -w "`n%{http_code}" `
        -H "Authorization: Bearer $token" `
        -H "Content-Type: application/json" `
        -X PUT "http://localhost:3001/api/stock/movements/$sysId" `
        -d '{"comment":"test"}'
    
    $lines = $test3 -split "`n"
    if ($lines[-1] -eq "400") {
        Write-Host "OK Status 400 (protected)" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL Expected 400, got $($lines[-1])" -ForegroundColor Red
    }
}
else {
    Write-Host "SKIP No system movements" -ForegroundColor Yellow
}
""

Write-Host "=== COMPLETE ===" -ForegroundColor Cyan
