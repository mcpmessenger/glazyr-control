# Quick deployment script for glazyr-control to AWS Lambda
# Run this to deploy so you can use the dashboard

param(
    [Parameter(Mandatory = $true)]
    [string]$OpenAIKeySecretArn,
    
    [Parameter(Mandatory = $false)]
    [string]$Region = "us-east-1",
    
    [Parameter(Mandatory = $false)]
    [string]$Stage = "dev",
    
    [Parameter(Mandatory = $false)]
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying glazyr-control to AWS Lambda..." -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Stage: $Stage" -ForegroundColor Yellow
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Cyan

try {
    aws --version | Out-Null
    Write-Host "✅ AWS CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI not found. Install from: https://aws.amazon.com/cli/" -ForegroundColor Red
    exit 1
}

try {
    sam --version | Out-Null
    Write-Host "✅ AWS SAM CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS SAM CLI not found. Install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html" -ForegroundColor Red
    exit 1
}

# Verify secret exists
Write-Host ""
Write-Host "Verifying secret exists..." -ForegroundColor Cyan
try {
    aws secretsmanager describe-secret --secret-id $OpenAIKeySecretArn --region $Region | Out-Null
    Write-Host "✅ Secret verified" -ForegroundColor Green
} catch {
    Write-Host "❌ Secret not found: $OpenAIKeySecretArn" -ForegroundColor Red
    Write-Host ""
    Write-Host "Create it with:" -ForegroundColor Yellow
    Write-Host "  aws secretsmanager create-secret \`" -ForegroundColor Gray
    Write-Host "    --name glazyr-control/openai-api-key \`" -ForegroundColor Gray
    Write-Host "    --secret-string `"sk-your-key-here`" \`" -ForegroundColor Gray
    Write-Host "    --region $Region" -ForegroundColor Gray
    exit 1
}

# Build and deploy
Write-Host ""
Write-Host "Building application..." -ForegroundColor Cyan
sam build --use-container

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful" -ForegroundColor Green

Write-Host ""
Write-Host "Deploying to AWS Lambda..." -ForegroundColor Cyan

$deployParams = @(
    "sam", "deploy",
    "--region", $Region,
    "--stack-name", "glazyr-control-$Stage",
    "--capabilities", "CAPABILITY_IAM",
    "--resolve-s3",
    "--no-confirm-changeset",
    "--no-fail-on-empty-changeset",
    "--parameter-overrides",
    "ServiceName=glazyr-control",
    "Stage=$Stage",
    "ApiKey=$ApiKey",
    "PayloadMaxBytes=5242880",
    "AllowedDomains=",
    "OpenAIKeySecretArn=$OpenAIKeySecretArn",
    "OpenAIModel=gpt-4o-mini"
)

& $deployParams[0] $deployParams[1..($deployParams.Length-1)]

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

# Get Function URL
Write-Host ""
Write-Host "Getting Function URL..." -ForegroundColor Cyan
$functionUrl = aws cloudformation describe-stacks `
    --region $Region `
    --stack-name "glazyr-control-$Stage" `
    --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" `
    --output text

if (-not $functionUrl) {
    Write-Host "⚠️  Could not retrieve Function URL. Check CloudFormation console." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Function URL: $functionUrl" -ForegroundColor Cyan
Write-Host ""

# Test the deployment
Write-Host "Testing deployment..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$functionUrl/healthz" -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health check passed" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Health check failed (may need a moment to initialize)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Set environment variable in glazyr-main:" -ForegroundColor White
Write-Host "   GLAZYR_CONTROL_RUNTIME_URL=$functionUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "2. If you set an ApiKey, also set:" -ForegroundColor White
if ($ApiKey) {
    Write-Host "   GLAZYR_CONTROL_RUNTIME_API_KEY=$ApiKey" -ForegroundColor Gray
} else {
    Write-Host "   GLAZYR_CONTROL_RUNTIME_API_KEY=<your-api-key>" -ForegroundColor Gray
    Write-Host "   (Or redeploy with -ApiKey parameter)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "3. In glazyr-main, create/edit .env.local:" -ForegroundColor White
Write-Host ('   echo GLAZYR_CONTROL_RUNTIME_URL=' + $functionUrl + ' > .env.local') -ForegroundColor Gray
if ($ApiKey) {
    Write-Host ('   echo GLAZYR_CONTROL_RUNTIME_API_KEY=' + $ApiKey + ' >> .env.local') -ForegroundColor Gray
}
Write-Host ""
Write-Host "4. Restart the Next.js dev server in glazyr-main" -ForegroundColor White
Write-Host ""
