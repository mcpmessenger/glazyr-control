# Deploy glazyr-control using AWS CLI (with SAM for building)
# This script uses AWS CLI for deployment operations and SAM CLI for building

param(
  [Parameter(Mandatory = $false)][string]$Region = "us-east-1",
  [Parameter(Mandatory = $false)][string]$Stage = "dev",
  [Parameter(Mandatory = $false)][string]$ServiceName = "glazyr-control",
  [Parameter(Mandatory = $false)][string]$ApiKey = "",
  [Parameter(Mandatory = $false)][string]$OpenAIKeySecretArn = "",
  [Parameter(Mandatory = $false)][string]$OpenAIModel = "gpt-4o-mini",
  [Parameter(Mandatory = $false)][string]$AllowedDomains = "",
  [Parameter(Mandatory = $false)][int]$PayloadMaxBytes = 5242880
)

$ErrorActionPreference = "Stop"

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Missing required command: $name" -ForegroundColor Red
    return $false
  }
  return $true
}

# Check for AWS CLI
if (-not (Require-Command "aws")) {
  Write-Host ""
  Write-Host "Install AWS CLI: https://aws.amazon.com/cli/" -ForegroundColor Yellow
  exit 1
}

# Check for SAM CLI
if (-not (Require-Command "sam")) {
  Write-Host ""
  Write-Host "SAM CLI is required for building Lambda packages." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Install SAM CLI:" -ForegroundColor Cyan
  Write-Host "  Windows: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html" -ForegroundColor White
  Write-Host ""
  Write-Host "Or use Chocolatey:" -ForegroundColor Cyan
  Write-Host "  choco install aws-sam-cli" -ForegroundColor White
  Write-Host ""
  Write-Host "Or use winget:" -ForegroundColor Cyan
  Write-Host "  winget install Amazon.SAM-CLI" -ForegroundColor White
  exit 1
}

Write-Host "✅ AWS CLI found: $(aws --version)" -ForegroundColor Green
Write-Host "✅ SAM CLI found: $(sam --version)" -ForegroundColor Green
Write-Host ""

# Verify AWS credentials
Write-Host "Verifying AWS credentials..." -ForegroundColor Cyan
try {
  $identity = aws sts get-caller-identity --region $Region 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ AWS credentials not configured or invalid" -ForegroundColor Red
    Write-Host "Run: aws configure" -ForegroundColor Yellow
    exit 1
  }
  Write-Host "✅ AWS credentials verified" -ForegroundColor Green
  Write-Host ""
} catch {
  Write-Host "❌ Failed to verify AWS credentials: $_" -ForegroundColor Red
  exit 1
}

$StackName = "$ServiceName-$Stage"

Write-Host "Building Lambda package with SAM..." -ForegroundColor Cyan
sam build --use-container
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ SAM build failed" -ForegroundColor Red
  exit 1
}
Write-Host "✅ Build complete" -ForegroundColor Green
Write-Host ""

# Build parameter overrides
$paramOverrides = @(
    "ServiceName=$ServiceName",
    "Stage=$Stage",
    "PayloadMaxBytes=$PayloadMaxBytes",
    "OpenAIKeySecretArn=$OpenAIKeySecretArn",
    "OpenAIModel=$OpenAIModel"
)

if ($ApiKey) {
    $paramOverrides += "ApiKey=$ApiKey"
}

if ($AllowedDomains) {
    $paramOverrides += "AllowedDomains=$AllowedDomains"
}

Write-Host "Deploying to AWS Lambda..." -ForegroundColor Cyan
Write-Host "  Stack: $StackName" -ForegroundColor Gray
Write-Host "  Region: $Region" -ForegroundColor Gray
Write-Host ""

# Use SAM deploy (which uses CloudFormation under the hood)
sam deploy `
  --region $Region `
  --stack-name $StackName `
  --capabilities CAPABILITY_IAM `
  --resolve-s3 `
  --no-confirm-changeset `
  --no-fail-on-empty-changeset `
  --parameter-overrides ($paramOverrides -join " ")

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Deployment failed" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host ""
Write-Host "Getting Function URL..." -ForegroundColor Cyan

# Use AWS CLI to get the Function URL
$functionUrl = aws cloudformation describe-stacks `
  --region $Region `
  --stack-name $StackName `
  --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" `
  --output text

if ($functionUrl) {
  Write-Host ""
  Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
  Write-Host "  Function URL:" -ForegroundColor White
  Write-Host "  $functionUrl" -ForegroundColor Green
  Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Test it:" -ForegroundColor Yellow
  Write-Host "  curl $functionUrl/healthz" -ForegroundColor White
  Write-Host ""
  Write-Host "Update extension:" -ForegroundColor Yellow
  Write-Host "  /runtime url $functionUrl" -ForegroundColor White
  Write-Host ""
} else {
  Write-Host "⚠️  Could not retrieve Function URL" -ForegroundColor Yellow
  Write-Host "Check CloudFormation stack outputs manually" -ForegroundColor Gray
}

