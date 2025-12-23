# Test VOID on existing manual movement
$loginJson = curl.exe -s http://localhost:3001/api/auth/login `
    -H "Content-Type: application/json" `
    --data-binary "@login.json"
$token = ($loginJson | ConvertFrom-Json).data.token

Write-Host "=== TESTING VOID ENDPOINT ===" -ForegroundColor Cyan
""

$movementId = "a88963c8-6bda-41c0-a969-569b2f195ca0"

# Test 1: Void with valid reason
Write-Host "[1] Voiding manual movement..." -ForegroundColor Yellow
$void1 = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$movementId/void" `
    -d '{"reason":"Testing PR2 void functionality - should work"}'

$lines = $void1 -split "`n"
$status = $lines[-1]
$body = $lines[0..($lines.Count - 2)] -join "`n"

Write-Host "Status: $status" -ForegroundColor $(if ($status -eq "200") { "Green" } else { "Red" })
if ($status -eq "200") {
    $result = $body | ConvertFrom-Json
    Write-Host "OK isVoid: $($result.data.isVoid)" -ForegroundColor Green
    Write-Host "   voidReason: $($result.data.voidReason)" -ForegroundColor Gray
}
else {
    Write-Host "Response: $body" -ForegroundColor Gray
}
""

# Test 2: Try to void same movement again
Write-Host "[2] Trying to void again..." -ForegroundColor Yellow
$void2 = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$movementId/void" `
    -d '{"reason":"Should fail - already voided"}'

$lines2 = $void2 -split "`n"
$status2 = $lines2[-1]
$body2 = $lines2[0..($lines2.Count - 2)] -join "`n"

Write-Host "Status: $status2" -ForegroundColor $(if ($status2 -eq "400") { "Green" } else { "Red" })
if ($status2 -eq "400") {
    $err = $body2 | ConvertFrom-Json
    Write-Host "OK Error: $($err.error)" -ForegroundColor Green
}
else {
    Write-Host "Response: $body2" -ForegroundColor Gray
}
""

Write-Host "=== COMPLETE ===" -ForegroundColor Cyan
