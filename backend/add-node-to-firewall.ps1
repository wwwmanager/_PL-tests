# =============================================================================
# Script to add Node.js to Windows Firewall exceptions
# RUN AS ADMINISTRATOR!
# =============================================================================

Write-Host "Adding Node.js to Windows Firewall exceptions..." -ForegroundColor Cyan
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
    Write-Host "5. Run: .\add-node-to-firewall.ps1" -ForegroundColor White
    Write-Host ""
    pause
    exit 1
}

# Find node.exe path
try {
    $nodePath = (Get-Command node -ErrorAction Stop).Path
    Write-Host "Found Node.js at: $nodePath" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js and try again." -ForegroundColor Yellow
    pause
    exit 1
}

# Remove old rules if they exist
Write-Host "Removing old rules (if any)..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "Node.js HTTPS Outbound" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Node.js HTTP Outbound" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Node.js All Outbound" -ErrorAction SilentlyContinue

# Create new outbound rule for all protocols
try {
    New-NetFirewallRule -DisplayName "Node.js All Outbound" `
        -Direction Outbound `
        -Program $nodePath `
        -Action Allow `
        -Profile Public,Private `
        -Enabled True `
        -ErrorAction Stop | Out-Null
    
    Write-Host ""
    Write-Host "SUCCESS! Node.js has been added to firewall exceptions!" -ForegroundColor Green
    Write-Host "Outbound connections allowed for Public and Private profiles" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now close this window and run in regular PowerShell:" -ForegroundColor Cyan
    Write-Host "    cd C:\_PL-tests\backend" -ForegroundColor White
    Write-Host "    npx prisma generate" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "ERROR creating firewall rule:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

pause
