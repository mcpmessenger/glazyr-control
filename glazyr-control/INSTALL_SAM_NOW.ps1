# Quick script to install SAM CLI globally

Write-Host "=== Install SAM CLI Globally ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "SAM CLI must be installed GLOBALLY (system-wide), not in a venv." -ForegroundColor Yellow
Write-Host ""

# Check if already installed
$samInstalled = Get-Command sam -ErrorAction SilentlyContinue
if ($samInstalled) {
    Write-Host "✅ SAM CLI is already installed!" -ForegroundColor Green
    Write-Host "   Version: $(sam --version)" -ForegroundColor Gray
    Write-Host "   Location: $($samInstalled.Source)" -ForegroundColor Gray
    exit 0
}

Write-Host "SAM CLI not found. Choose installation method:" -ForegroundColor Yellow
Write-Host ""

# Try winget first
if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "Option 1: Install with winget (Recommended)" -ForegroundColor Cyan
    Write-Host "  Run: winget install Amazon.SAM-CLI" -ForegroundColor White
    Write-Host ""
    $useWinget = Read-Host "Install with winget now? (Y/N)"
    if ($useWinget -eq "Y" -or $useWinget -eq "y") {
        Write-Host ""
        Write-Host "Installing SAM CLI..." -ForegroundColor Cyan
        winget install Amazon.SAM-CLI
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Installation complete!" -ForegroundColor Green
            Write-Host ""
            Write-Host "⚠️  IMPORTANT: Restart your terminal/PowerShell for changes to take effect" -ForegroundColor Yellow
            Write-Host "   Then run: sam --version" -ForegroundColor Gray
        } else {
            Write-Host ""
            Write-Host "❌ Installation failed. Try manual installation." -ForegroundColor Red
        }
        exit
    }
}

# Try Chocolatey
if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "Option 2: Install with Chocolatey" -ForegroundColor Cyan
    Write-Host "  Run: choco install aws-sam-cli" -ForegroundColor White
    Write-Host ""
    $useChoco = Read-Host "Install with Chocolatey now? (Y/N)"
    if ($useChoco -eq "Y" -or $useChoco -eq "y") {
        Write-Host ""
        Write-Host "Installing SAM CLI..." -ForegroundColor Cyan
        choco install aws-sam-cli -y
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Installation complete!" -ForegroundColor Green
            Write-Host ""
            Write-Host "⚠️  IMPORTANT: Restart your terminal/PowerShell for changes to take effect" -ForegroundColor Yellow
            Write-Host "   Then run: sam --version" -ForegroundColor Gray
        } else {
            Write-Host ""
            Write-Host "❌ Installation failed. Try manual installation." -ForegroundColor Red
        }
        exit
    }
}

Write-Host ""
Write-Host "Manual Installation Options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Download MSI installer:" -ForegroundColor Cyan
Write-Host "   https://github.com/aws/aws-sam-cli/releases/latest" -ForegroundColor White
Write-Host "   Download and run: AWSSAMCLI.msi" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Install via pip (if you have Python globally):" -ForegroundColor Cyan
Write-Host "   pip install aws-sam-cli" -ForegroundColor White
Write-Host "   (Note: Make sure pip is NOT pointing to a venv)" -ForegroundColor Gray
Write-Host ""
Write-Host "After installation, RESTART your terminal, then verify:" -ForegroundColor Yellow
Write-Host "   sam --version" -ForegroundColor White

