# Get real IDs for testing
$loginJson = curl.exe -s http://localhost:3001/api/auth/login `
    -H "Content-Type: application/json" `
    --data-binary "@login.json"
$token = ($loginJson | ConvertFrom-Json).data.token

# Get stock items
$itemsJson = curl.exe -s http://localhost:3001/api/stock/items `
    -H "Authorization: Bearer $token"
$items = ($itemsJson | ConvertFrom-Json).data
if ($items.Count -gt 0) {
    Write-Host "Stock Item ID: $($items[0].id)" -ForegroundColor Cyan
}

# Get locations
$locsJson = curl.exe -s http://localhost:3001/api/stock/locations `
    -H "Authorization: Bearer $token"
$locs = ($locsJson | ConvertFrom-Json).data
if ($locs.Count -gt 0) {
    Write-Host "Location ID: $($locs[0].id)" -ForegroundColor Cyan
}

# Get existing movements
$movsJson = curl.exe -s http://localhost:3001/api/stock/movements `
    -H "Authorization: Bearer $token"
$movs = ($movsJson | ConvertFrom-Json).data
Write-Host "`nTotal movements: $($movs.Count)" -ForegroundColor Yellow
if ($movs.Count -gt 0) {
    $manual = $movs | Where-Object { $null -eq $_.documentType } | Select-Object -First 1
    if ($manual) {
        Write-Host "Manual Movement ID: $($manual.id)" -ForegroundColor Green
        Write-Host "   Type: $($manual.movementType), Qty: $($manual.quantity), isVoid: $($manual.isVoid)" -ForegroundColor Gray
    }
    else {
        Write-Host "No manual movements found" -ForegroundColor Yellow
    }
}
