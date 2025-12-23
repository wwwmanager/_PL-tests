# Test RBAC on void endpoint
# STOCK-VOID-RBAC-PR2-005

Write-Host "=== RBAC TEST FOR VOID ENDPOINT ===" -ForegroundColor Cyan
""

# Test 1: Admin should be able to void
Write-Host "[1] Testing ADMIN access..." -ForegroundColor Yellow
$adminJson = curl.exe -s http://localhost:3001/api/auth/login `
    -H "Content-Type: application/json" `
    --data-binary "@login.json"
$adminToken = ($adminJson | ConvertFrom-Json).data.token

if (-not $adminToken) {
    Write-Host "FAIL Admin login failed" -ForegroundColor Red
    exit
}

# Get a manual movement ID
$movsJson = curl.exe -s -H "Authorization: Bearer $adminToken" http://localhost:3001/api/stock/movements
$movs = ($movsJson | ConvertFrom-Json).data
$manualMov = $movs | Where-Object { $null -eq $_.documentType -and -not $_.isVoid } | Select-Object -First 1

if (-not $manualMov) {
    Write-Host "SKIP No manual non-voided movements found" -ForegroundColor Yellow
    Write-Host "  Create a manual movement first" -ForegroundColor Gray
    exit
}

Write-Host "  Using movement: $($manualMov.id)" -ForegroundColor Gray

$voidTest = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $adminToken" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$($manualMov.id)/void" `
    -d '{"reason":"Testing RBAC - admin should have access"}'

$lines = $voidTest -split "`n"
$status = $lines[-1]

Write-Host "  Status: $status" -ForegroundColor $(if ($status -eq "200") { "Green" } else { "Red" })

if ($status -eq "200") {
    Write-Host "OK Admin can void movements" -ForegroundColor Green
}
else {
    Write-Host "FAIL Admin should be able to void (got $status)" -ForegroundColor Red
    Write-Host "   Response: $($lines[0..($lines.Count-2)] -join "`n")" -ForegroundColor Gray
}
""

# Test 2: Check if we have a driver user
Write-Host "[2] Testing DRIVER access (should be FORBIDDEN)..." -ForegroundColor Yellow

# Try to login as driver (if exists)
$driverLoginJson = '{"email":"driver@waybills.local","password":"123"}'
Set-Content -Path "driver-login.json" -Value $driverLoginJson

$driverJson = curl.exe -s http://localhost:3001/api/auth/login `
    -H "Content-Type: application/json" `
    --data-binary "@driver-login.json" 2>$null

$driverData = $driverJson | ConvertFrom-Json
$driverToken = $driverData.data.token

if (-not $driverToken) {
    Write-Host "SKIP No driver user found (driver@waybills.local)" -ForegroundColor Yellow
    Write-Host "   Cannot test driver prohibition" -ForegroundColor Gray
}
else {
    Write-Host "  Logged in as driver" -ForegroundColor Gray
    
    # Get another manual movement
    $movsJson2 = curl.exe -s -H "Authorization: Bearer $adminToken" http://localhost:3001/api/stock/movements
    $movs2 = ($movsJson2 | ConvertFrom-Json).data
    $manualMov2 = $movs2 | Where-Object { $null -eq $_.documentType -and -not $_.isVoid } | Select-Object -First 2 | Select-Object -Last 1
    
    if (-not $manualMov2) {
        Write-Host "SKIP No second manual movement for driver test" -ForegroundColor Yellow
    }
    else {
        $voidTest2 = curl.exe -s -w "`n%{http_code}" `
            -H "Authorization: Bearer $driverToken" `
            -H "Content-Type: application/json" `
            -X POST "http://localhost:3001/api/stock/movements/$($manualMov2.id)/void" `
            -d '{"reason":"Driver trying to void - should be forbidden"}'

        $lines2 = $voidTest2 -split "`n"
        $status2 = $lines2[-1]

        Write-Host "  Status: $status2" -ForegroundColor $(if ($status2 -eq "403") { "Green" } else { "Red" })

        if ($status2 -eq "403") {
            Write-Host "OK Driver correctly forbidden (403)" -ForegroundColor Green
            $body = $lines2[0..($lines2.Count - 2)] -join "`n" | ConvertFrom-Json
            Write-Host "   Error: $($body.error)" -ForegroundColor Gray
        }
        else {
            Write-Host "FAIL Driver should get 403, got $status2" -ForegroundColor Red
            Write-Host "   Response: $($lines2[0..($lines2.Count-2)] -join "`n")" -ForegroundColor Gray
        }
    }
}
""

# Cleanup
Remove-Item "driver-login.json" -ErrorAction SilentlyContinue

Write-Host "=== RBAC TEST COMPLETE ===" -ForegroundColor Cyan
