param(
  [Parameter(Mandatory = $false)][string]$Region = "us-east-1",
  [Parameter(Mandatory = $false)][string]$Stage = "dev",
  [Parameter(Mandatory = $false)][string]$ServiceName = "glazyr-control",
  # Optional: require clients to send this key for /mcp/* and /api/* routes
  [Parameter(Mandatory = $false)][string]$ApiKey = "",
  # Optional: secrets manager ARN holding OpenAI key
  [Parameter(Mandatory = $false)][string]$OpenAIKeySecretArn = "",
  [Parameter(Mandatory = $false)][string]$OpenAIModel = "gpt-4o-mini",
  [Parameter(Mandatory = $false)][string]$AllowedDomains = "",
  [Parameter(Mandatory = $false)][int]$PayloadMaxBytes = 5242880
)

$ErrorActionPreference = "Stop"

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $name"
  }
}

Require-Command aws
Require-Command sam

$StackName = "$ServiceName-$Stage"

sam build --use-container

# Build parameter overrides, skipping empty values
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

sam deploy `
  --region $Region `
  --stack-name $StackName `
  --capabilities CAPABILITY_IAM `
  --resolve-s3 `
  --no-confirm-changeset `
  --no-fail-on-empty-changeset `
  --parameter-overrides ($paramOverrides -join " ")

Write-Host ""
Write-Host "Deployed stack: $StackName"
Write-Host "Function URL:"
aws cloudformation describe-stacks --region $Region --stack-name $StackName --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" --output text

