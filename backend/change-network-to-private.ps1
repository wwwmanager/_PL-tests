# =============================================================================
# Script to change network type to Private
# RUN AS ADMINISTRATOR!
# =============================================================================

Write-Host "Changing network type to Private..." -ForegroundColor Cyan
Write-Host ""

# Check for administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "How to run:" -ForegroundColor Yellow
    Write-Host "1. Close this PowerShell window" -ForegroundColor White
    Write-Host "2. Find PowerShell in Start menu" -ForegroundColor White
    Write-Host "3. Right-click -> Run as administrator" -ForegroundColor White
    Write-Host "4. Navigate to folder: cd C:\_PL-tests\backend" -ForegroundColor White
    Write-Host "5. Run: .\change-network-to-private.ps1" -ForegroundColor White
    Write-Host ""
    pause
    exit 1
}

# Show current networks
Write-Host "Current network profiles:" -ForegroundColor Yellow
Get-NetConnectionProfile | Format-Table Name, NetworkCategory, InterfaceAlias -AutoSize
Write-Host ""

# Find active connection
$activeProfile = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -eq 'Internet' -or $_.NetworkCategory -eq 'Public' } | Select-Object -First 1

if (-not $activeProfile) {
    Write-Host "No active network connection found." -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Active connection: $($activeProfile.Name) ($($activeProfile.InterfaceAlias))" -ForegroundColor Cyan
Write-Host "Current type: $($activeProfile.NetworkCategory)" -ForegroundColor Yellow

if ($activeProfile.NetworkCategory -eq 'Private') {
    Write-Host ""
    Write-Host "SUCCESS! Network is already configured as Private!" -ForegroundColor Green
    Write-Host ""
    Write-Host "If Prisma issue persists, try:" -ForegroundColor Cyan
    Write-Host "    .\add-node-to-firewall.ps1" -ForegroundColor White
    Write-Host ""
    pause
    exit 0
}

# Change to Private
try {
    Write-Host ""
    Write-Host "Changing network type to Private..." -ForegroundColor Yellow
    
    Set-NetConnectionProfile -InterfaceAlias $activeProfile.InterfaceAlias -NetworkCategory Private -ErrorAction Stop
    
    Write-Host ""
    Write-Host "SUCCESS! Network type changed to Private!" -ForegroundColor Green
    Write-Host ""
    Write-Host "New settings:" -ForegroundColor Cyan
    Get-NetConnectionProfile -InterfaceAlias $activeProfile.InterfaceAlias | Format-Table Name, NetworkCategory, InterfaceAlias -AutoSize
    Write-Host ""
    Write-Host "You can now close this window and run in regular PowerShell:" -ForegroundColor Cyan
    Write-Host "    cd C:\_PL-tests\backend" -ForegroundColor White
    Write-Host "    npx prisma generate" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "ERROR changing network type:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Try changing network type via GUI:" -ForegroundColor Yellow
    Write-Host "1. Win + I -> Network & Internet -> Ethernet" -ForegroundColor White
    Write-Host "2. Click on connection '$($activeProfile.Name)'" -ForegroundColor White
    Write-Host "3. Select Private in Network profile type" -ForegroundColor White
    Write-Host ""
    pause
    exit 1
}

pause
