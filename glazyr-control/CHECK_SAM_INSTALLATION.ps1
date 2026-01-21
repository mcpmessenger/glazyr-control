# Check if SAM CLI is installed and accessible

Write-Host "=== SAM CLI Installation Check ===" -ForegroundColor Cyan
Write-Host ""

# Check if SAM is in PATH
$samInPath = Get-Command sam -ErrorAction SilentlyContinue
if ($samInPath) {
    Write-Host "✅ SAM CLI found in PATH" -ForegroundColor Green
    Write-Host "   Version: $(sam --version)" -ForegroundColor Gray
    Write-Host "   Location: $($samInPath.Source)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✅ Ready to deploy!" -ForegroundColor Green
    exit 0
}

Write-Host "❌ SAM CLI not found in PATH" -ForegroundColor Red
Write-Host ""

# Check common installation locations
Write-Host "Checking common installation locations..." -ForegroundColor Yellow
$commonPaths = @(
    "C:\Program Files\Amazon\SAM CLI\bin\sam.cmd",
    "C:\Program Files (x86)\Amazon\SAM CLI\bin\sam.cmd",
    "$env:LOCALAPPDATA\Programs\Amazon\SAM CLI\sam.cmd",
    "$env:USERPROFILE\.aws-sam\bin\sam.cmd"
)

$found = $false
foreach ($path in $commonPaths) {
    if (Test-Path $path) {
        Write-Host "✅ Found SAM at: $path" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  SAM is installed but not in PATH" -ForegroundColor Yellow
        Write-Host "   Add to PATH or use full path:" -ForegroundColor Gray
        Write-Host "   & `"$path`" --version" -ForegroundColor White
        $found = $true
        break
    }
}

if (-not $found) {
    Write-Host "❌ SAM CLI not found in common locations" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install SAM CLI:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Option 1: winget (Recommended)" -ForegroundColor Yellow
    Write-Host "  winget install Amazon.SAM-CLI" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Chocolatey" -ForegroundColor Yellow
    Write-Host "  choco install aws-sam-cli" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 3: Download MSI" -ForegroundColor Yellow
    Write-Host "  https://github.com/aws/aws-sam-cli/releases/latest" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "Note: SAM CLI should be installed GLOBALLY (system-wide)," -ForegroundColor Cyan
Write-Host "      NOT in a Python virtual environment." -ForegroundColor Cyan
Write-Host ""

