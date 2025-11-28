# =============================================================================
# Temporary disable Windows Defender Real-Time Protection
# RUN AS ADMINISTRATOR!
# ONLY FOR TESTING - RE-ENABLE AFTER PRISMA INSTALL!
# =============================================================================

Write-Host "IMPORTANT: This will TEMPORARILY disable Windows Defender" -ForegroundColor Red
Write-Host "Only for testing Prisma engine download" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to cancel, or any key to continue..." -ForegroundColor Cyan
pause

# Check for administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

Write-Host ""
Write-Host "Temporarily disabling Real-Time Protection..." -ForegroundColor Yellow

try {
    Set-MpPreference -DisableRealtimeMonitoring $true -ErrorAction Stop
    
    Write-Host "Real-Time Protection DISABLED" -ForegroundColor Green
    Write-Host ""
    Write-Host "NOW QUICKLY RUN IN ANOTHER POWERSHELL WINDOW:" -ForegroundColor Cyan
    Write-Host "    cd C:\_PL-tests\backend" -ForegroundColor White
    Write-Host "    npx prisma generate" -ForegroundColor White
    Write-Host ""
    Write-Host "After Prisma finishes, come back here and press any key" -ForegroundColor Yellow
    Write-Host "to RE-ENABLE Windows Defender!" -ForegroundColor Red
    Write-Host ""
    
    pause
    
    Write-Host ""
    Write-Host "Re-enabling Real-Time Protection..." -ForegroundColor Yellow
    Set-MpPreference -DisableRealtimeMonitoring $false
    
    Write-Host "Real-Time Protection RE-ENABLED" -ForegroundColor Green
    Write-Host "Windows Defender is now protecting your computer again." -ForegroundColor Green
    Write-Host ""
    
}
catch {
    Write-Host "ERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
}

pause
