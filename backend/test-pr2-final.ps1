# PR2 Smoke Tests - Final Verification
# Run after Prisma generate

Write-Host "=== PR2 SMOKE TESTS ===" -ForegroundColor Cyan
""

# Login as admin
$adminJson = curl.exe -s http://localhost:3001/api/auth/login `
    -H "Content-Type: application/json" `
    --data-binary "@login.json"
$adminToken = ($adminJson | ConvertFrom-Json).data.token

if (-not $adminToken) {
    Write-Host "FAIL Admin login failed" -ForegroundColor Red
    exit
}
Write-Host "OK Logged in as admin" -ForegroundColor Green
""

# Get a manual non-voided movement
$movsJson = curl.exe -s -H "Authorization: Bearer $adminToken" http://localhost:3001/api/stock/movements
$movs = ($movsJson | ConvertFrom-Json).data
$manualMov = $movs | Where-Object { $null -eq $_.documentType -and -not $_.isVoid } | Select-Object -First 1

if (-not $manualMov) {
    Write-Host "SKIP No manual movements found - creating one..." -ForegroundColor Yellow
    
    # Get stock item and location
    $itemsJson = curl.exe -s -H "Authorization: Bearer $adminToken" http://localhost:3001/api/stock/items
    $item = ($itemsJson | ConvertFrom-Json).data[0]
    
    $locsJson = curl.exe -s -H "Authorization: Bearer $adminToken" http://localhost:3001/api/stock/locations
    $loc = ($locsJson | ConvertFrom-Json).data | Where-Object { $_.type -eq "WAREHOUSE" } | Select-Object -First 1
    
    if (-not $item -or -not $loc) {
        Write-Host "ERROR Cannot create test movement - missing item/location" -ForegroundColor Red
        exit
    }
    
    $createPayload = @{
        movementType    = "INCOME"
        stockItemId     = $item.id
        stockLocationId = $loc.id
        quantity        = "5.000"
        occurredAt      = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        comment         = "PR2 smoke test movement"
    } | ConvertTo-Json -Compress
    
    $createJson = curl.exe -s -H "Authorization: Bearer $adminToken" `
        -H "Content-Type: application/json" `
        -X POST http://localhost:3001/api/stock/movements/v2 `
        -d $createPayload
    
    $manualMov = $createJson | ConvertFrom-Json
    if (-not $manualMov.id) {
        Write-Host "ERROR Failed to create test movement" -ForegroundColor Red
        Write-Host "  Response: $createJson" -ForegroundColor Gray
        exit
    }
    Write-Host "  Created test movement: $($manualMov.id)" -ForegroundColor Gray
}

$movId = $manualMov.id
Write-Host "Using movement: $movId" -ForegroundColor White
""

# Test 1: Admin void (should succeed)
Write-Host "[1] Admin void test..." -ForegroundColor Yellow
$test1 = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $adminToken" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$movId/void" `
    -d '{"reason":"PR2 final smoke test - admin void"}'

$lines1 = $test1 -split "`n"
$status1 = $lines1[-1]
$body1 = $lines1[0..($lines1.Count - 2)] -join "`n"

Write-Host "  Status: $status1" -ForegroundColor $(if ($status1 -eq "200") { "Green" } else { "Red" })
Write-Host "  Body: $body1" -ForegroundColor Gray

if ($status1 -eq "200") {
    $result = $body1 | ConvertFrom-Json
    if ($result.success -and $result.data.isVoid) {
        Write-Host "  ✓ Movement voided successfully" -ForegroundColor Green
    }
    else {
        Write-Host "  ✗ Unexpected response structure" -ForegroundColor Yellow
    }
}
else {
    Write-Host "  ✗ FAIL Expected 200" -ForegroundColor Red
}
""

# Test 2: Try to void again (should fail 400)
Write-Host "[2] Re-void test (should fail)..." -ForegroundColor Yellow
$test2 = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $adminToken" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$movId/void" `
    -d '{"reason":"Trying to void again"}'

$lines2 = $test2 -split "`n"
$status2 = $lines2[-1]
$body2 = $lines2[0..($lines2.Count - 2)] -join "`n"

Write-Host "  Status: $status2" -ForegroundColor $(if ($status2 -eq "400") { "Green" } else { "Red" })
Write-Host "  Body: $body2" -ForegroundColor Gray

if ($status2 -eq "400") {
    Write-Host "  ✓ Correctly rejected re-void" -ForegroundColor Green
}
else {
    Write-Host "  ✗ Should get 400 for already voided" -ForegroundColor Yellow
}
""

# Test 3: Check movement hidden from list
Write-Host "[3] Movement visibility test..." -ForegroundColor Yellow
$test3 = curl.exe -s -H "Authorization: Bearer $adminToken" `
    "http://localhost:3001/api/stock/movements/v2"
$list = ($test3 | ConvertFrom-Json).data
$found = $list | Where-Object { $_.id -eq $movId }

if ($null -eq $found) {
    Write-Host "  ✓ Voided movement hidden from list" -ForegroundColor Green
}
else {
    Write-Host "  ✗ Voided movement should be hidden (isVoid filter)" -ForegroundColor Yellow
}
""

# Test 4: RBAC - try with accountant role (if exists)
Write-Host "[4] RBAC test (accountant)..." -ForegroundColor Yellow
Write-Host "  SKIP No accountant test user configured" -ForegroundColor Gray
""

Write-Host "=== SMOKE TESTS COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Results:" -ForegroundColor White
Write-Host "  [1] Admin void: $status1 (expected: 200)" -ForegroundColor $(if ($status1 -eq "200") { "Green" } else { "Red" })
Write-Host "  [2] Re-void blocked: $status2 (expected: 400)" -ForegroundColor $(if ($status2 -eq "400") { "Green" } else { "Red" })
Write-Host "  [3] Movement hidden: $(if ($null -eq $found) {"YES"} else {"NO"}) (expected: YES)" -ForegroundColor $(if ($null -eq $found) { "Green" } else { "Red" })
