# PR2 TRANSFER Void Test - STOCK-VOID-CHECK-003
# Test scenario:
# 1. TRANSFER +100 (warehouse -> fuel card)
# 2. EXPENSE -80 from fuel card (balance = 20)
# 3. Try to void TRANSFER -> should FAIL (balance would be -80)

Write-Host "=== PR2 TRANSFER VOID TEST ===" -ForegroundColor Cyan
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

# Get IDs
$itemsJson = curl.exe -s -H "Authorization: Bearer $token" http://localhost:3001/api/stock/items
$item = ($itemsJson | ConvertFrom-Json).data[0]
$itemId = $item.id

$locsJson = curl.exe -s -H "Authorization: Bearer $token" http://localhost:3001/api/stock/locations
$locs = ($locsJson | ConvertFrom-Json).data

$warehouse = $locs | Where-Object { $_.type -eq "WAREHOUSE" } | Select-Object -First 1
$fuelCard = $locs | Where-Object { $_.type -eq "FUEL_CARD" } | Select-Object -First 1

if (-not $warehouse -or -not $fuelCard) {
    Write-Host "SKIP No warehouse or fuel card locations found" -ForegroundColor Yellow
    exit
}

Write-Host "Using:" -ForegroundColor Gray
Write-Host "  Item: $($item.name) ($itemId)" -ForegroundColor Gray
Write-Host "  Warehouse: $($warehouse.name) ($($warehouse.id))" -ForegroundColor Gray
Write-Host "  Fuel Card: $($fuelCard.name) ($($fuelCard.id))" -ForegroundColor Gray
""

# Step 1: Create TRANSFER (warehouse -> card, +100)
Write-Host "[1] Creating TRANSFER +100 (warehouse -> card)..." -ForegroundColor Yellow
$transferPayload = @{
    movementType   = "TRANSFER"
    stockItemId    = $itemId
    fromLocationId = $warehouse.id
    toLocationId   = $fuelCard.id
    quantity       = "100.000"
    occurredAt     = "2025-12-23T10:00:00Z"
    externalRef    = "TEST_VOID_TRANSFER_$(Get-Date -Format 'HHmmss')"
    comment        = "Transfer for void test"
} | ConvertTo-Json -Compress

$transferJson = curl.exe -s -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST http://localhost:3001/api/stock/movements/v2 `
    -d $transferPayload

$transfer = $transferJson | ConvertFrom-Json
if ($transfer.id) {
    $transferId = $transfer.id
    Write-Host "OK Created TRANSFER: $transferId" -ForegroundColor Green
}
else {
    Write-Host "FAIL Could not create TRANSFER" -ForegroundColor Red
    Write-Host "  Response: $transferJson" -ForegroundColor Gray
    exit
}
""

# Step 2: Create EXPENSE from card (-80)
Write-Host "[2] Creating EXPENSE -80 from card..." -ForegroundColor Yellow
$expensePayload = @{
    movementType    = "EXPENSE"
    stockItemId     = $itemId
    stockLocationId = $fuelCard.id
    quantity        = "80.000"
    occurredAt      = "2025-12-23T11:00:00Z"
    externalRef     = "TEST_CONSUMPTION_$(Get-Date -Format 'HHmmss')"
    comment         = "Fuel consumed"
} | ConvertTo-Json -Compress

$expenseJson = curl.exe -s -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST http://localhost:3001/api/stock/movements/v2 `
    -d $expensePayload

$expense = $expenseJson | ConvertFrom-Json
if ($expense.id) {
    Write-Host "OK Created EXPENSE: $($expense.id)" -ForegroundColor Green
}
else {
    Write-Host "FAIL Could not create EXPENSE" -ForegroundColor Red
    Write-Host "  Response: $expenseJson" -ForegroundColor Gray
    exit
}
""

# Step 3: Check balance (should be 20)
Write-Host "[3] Checking balance..." -ForegroundColor Yellow
$balanceJson = curl.exe -s -H "Authorization: Bearer $token" `
    "http://localhost:3001/api/stock/balance?locationId=$($fuelCard.id)&stockItemId=$itemId"
$balance = ($balanceJson | ConvertFrom-Json).balance

Write-Host "  Balance: $balance" -ForegroundColor $(if ($balance -eq 20) { "Green" } else { "Yellow" })
if ($balance -ne 20) {
    Write-Host "  WARNING: Expected 20, got $balance" -ForegroundColor Yellow
}
""

# Step 4: Try to void TRANSFER -> SHOULD FAIL
Write-Host "[4] Trying to void TRANSFER (should FAIL)..." -ForegroundColor Yellow
$voidTest = curl.exe -s -w "`n%{http_code}" `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -X POST "http://localhost:3001/api/stock/movements/$transferId/void" `
    -d '{"reason":"Testing future negative check for TRANSFER"}'

$lines = $voidTest -split "`n"
$status = $lines[-1]
$body = $lines[0..($lines.Count - 2)] -join "`n"

Write-Host "  Status: $status" -ForegroundColor $(if ($status -eq "400") { "Green" } else { "Red" })

if ($status -eq "400") {
    $err = $body | ConvertFrom-Json
    Write-Host "OK Void rejected:" -ForegroundColor Green
    Write-Host "   Error: $($err.error)" -ForegroundColor Gray
    if ($err.error -like "*negative balance*") {
        Write-Host "✓ Correct error message (mentions negative balance)" -ForegroundColor Green
    }
}
else {
    Write-Host "FAIL Expected 400, got $status" -ForegroundColor Red
    Write-Host "   Body: $body" -ForegroundColor Gray
}
""

Write-Host "=== TEST COMPLETE ===" -ForegroundColor Cyan
