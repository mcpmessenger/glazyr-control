param(
  [Parameter(Mandatory = $false)][string]$Region = "us-east-1",
  [Parameter(Mandatory = $false)][string]$Prefix = "glazyr-runtime",
  [Parameter(Mandatory = $false)][string]$RuntimeApiKey = "",
  # Optional: provide the Google Vision service account JSON as a string.
  # If omitted, the script will use $env:GOOGLE_VISION_SERVICE_ACCOUNT_JSON if present.
  [Parameter(Mandatory = $false)][string]$GoogleVisionServiceAccountJson = "",
  # Optional (recommended): path to a service account JSON file. If provided, the script reads it and sets
  # GOOGLE_VISION_SERVICE_ACCOUNT_JSON on the ingest lambda.
  [Parameter(Mandatory = $false)][string]$GoogleVisionServiceAccountJsonFile = ""
)

$ErrorActionPreference = "Stop"

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $name"
  }
}

function Invoke-Aws([string]$AwsArgs) {
  # Run aws cli via cmd.exe so a single string is parsed as expected.
  $out = cmd /c "aws $AwsArgs"
  if ($LASTEXITCODE -ne 0) {
    throw "aws failed ($LASTEXITCODE): aws $AwsArgs"
  }
  return $out
}

function Write-TempJson([string]$Content) {
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("glazyr-" + [System.Guid]::NewGuid().ToString() + ".json")
  # Write UTF-8 without BOM (AWS CLI paramfile parser can reject BOM)
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tmp, $Content, $utf8NoBom)
  return $tmp
}

function To-FileUri([string]$Path) {
  $p = (Resolve-Path -LiteralPath $Path).Path
  # AWS CLI on Windows accepts: file://C:\path\to\file.json
  return "file://$p"
}

Require-Command aws
Require-Command npm

Invoke-Aws "sts get-caller-identity" | Out-Null

$TasksTable = "$Prefix-tasks"
$ActionsTable = "$Prefix-actions"
$QueueName = "$Prefix-steps"

$IngestFn = "$Prefix-ingest"
$WorkerFn = "$Prefix-worker"

$RoleName = "$Prefix-lambda-role"
$RoleArn = ""

Write-Host "Region: $Region"
Write-Host "Tables: $TasksTable / $ActionsTable"
Write-Host "Queue: $QueueName"
Write-Host "Lambdas: $IngestFn / $WorkerFn"

# --- DynamoDB tables ---
Write-Host "Ensuring DynamoDB tables..."
try {
  Invoke-Aws "dynamodb describe-table --region $Region --table-name $TasksTable" | Out-Null
} catch {
  Invoke-Aws "dynamodb create-table --region $Region --table-name $TasksTable --attribute-definitions AttributeName=taskId,AttributeType=S --key-schema AttributeName=taskId,KeyType=HASH --billing-mode PAY_PER_REQUEST" | Out-Null
  Invoke-Aws "dynamodb wait table-exists --region $Region --table-name $TasksTable" | Out-Null
}

try {
  Invoke-Aws "dynamodb describe-table --region $Region --table-name $ActionsTable" | Out-Null
} catch {
  Invoke-Aws "dynamodb create-table --region $Region --table-name $ActionsTable --attribute-definitions AttributeName=deviceId,AttributeType=S AttributeName=sortKey,AttributeType=S --key-schema AttributeName=deviceId,KeyType=HASH AttributeName=sortKey,KeyType=RANGE --billing-mode PAY_PER_REQUEST" | Out-Null
  Invoke-Aws "dynamodb wait table-exists --region $Region --table-name $ActionsTable" | Out-Null
}

# --- SQS queue ---
Write-Host "Ensuring SQS queue..."
$QueueUrl = ""
try {
  $QueueUrl = (& aws sqs get-queue-url --region $Region --queue-name $QueueName --query "QueueUrl" --output text)
  if ($LASTEXITCODE -ne 0) { throw "get-queue-url failed" }
} catch {
  $QueueUrl = (& aws sqs create-queue --region $Region --queue-name $QueueName --query "QueueUrl" --output text)
  if ($LASTEXITCODE -ne 0) { throw "create-queue failed" }
}
Write-Host "QueueUrl: $QueueUrl"

$QueueArn = (& aws sqs get-queue-attributes --region $Region --queue-url $QueueUrl --attribute-names QueueArn --query "Attributes.QueueArn" --output text)
if ($LASTEXITCODE -ne 0) { throw "get-queue-attributes failed" }
Write-Host "QueueArn: $QueueArn"

# --- IAM role ---
Write-Host "Ensuring IAM role..."
$Trust = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@

try {
  $RoleArn = (& aws iam get-role --role-name $RoleName --query "Role.Arn" --output text)
  if ($LASTEXITCODE -ne 0) { throw "get-role failed" }
} catch {
  $trustPath = Write-TempJson $Trust
  $trustUri = To-FileUri $trustPath
  $RoleArn = (& aws iam create-role --role-name $RoleName --assume-role-policy-document $trustUri --query "Role.Arn" --output text)
  if ($LASTEXITCODE -ne 0) { throw "create-role failed" }
}
Write-Host "RoleArn: $RoleArn"

Invoke-Aws "iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" | Out-Null

$PolicyDoc = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:DeleteItem",
        "dynamodb:TransactWriteItems"
      ],
      "Resource": [
        "arn:aws:dynamodb:${Region}:*:table/${TasksTable}",
        "arn:aws:dynamodb:${Region}:*:table/${ActionsTable}"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "$QueueArn"
    }
  ]
}
"@

Write-Host "Putting inline policy..."
$policyPath = Write-TempJson $PolicyDoc
$policyUri = To-FileUri $policyPath
Invoke-Aws "iam put-role-policy --role-name $RoleName --policy-name $Prefix-inline --policy-document $policyUri" | Out-Null

# IAM propagation can take a few seconds; keep output flowing to avoid idle aborts.
for ($i = 1; $i -le 15; $i++) {
  Write-Host "Waiting for IAM propagation... $i/15"
  Start-Sleep -Seconds 1
}

# --- Package lambdas ---
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$OutDir = Join-Path $RepoRoot "runtime-aws\dist"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$IngestZip = Join-Path $OutDir "ingest.zip"
$WorkerZip = Join-Path $OutDir "worker.zip"

if (Test-Path $IngestZip) { Remove-Item $IngestZip -Force }
if (Test-Path $WorkerZip) { Remove-Item $WorkerZip -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Zip-SingleFile($src, $zipPath) {
  $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
  Copy-Item -Force $src (Join-Path $tmpDir "index.js")
  [System.IO.Compression.ZipFile]::CreateFromDirectory($tmpDir, $zipPath)
  Remove-Item -Recurse -Force $tmpDir
}

function Install-And-Zip($srcDir, $zipPath) {
  # Install deps and package folder contents at zip root.
  # Always run install so packaging stays in sync with package.json changes.
  Push-Location $srcDir
  try {
    if (Test-Path (Join-Path $srcDir "package-lock.json")) {
      npm ci --omit=dev
    } else {
      npm install --omit=dev
    }
  } finally {
    Pop-Location
  }

  $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
  Copy-Item -Recurse -Force (Join-Path $srcDir "*") $tmpDir
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($tmpDir, $zipPath)
  Remove-Item -Recurse -Force $tmpDir
}

Install-And-Zip (Join-Path $RepoRoot "runtime-aws\lambda\ingest") $IngestZip
Install-And-Zip (Join-Path $RepoRoot "runtime-aws\lambda\worker") $WorkerZip

# --- Create/Update Lambda functions ---
Write-Host "Deploying Lambda functions..."
$EnvVars = @{
  TASKS_TABLE = $TasksTable
  ACTIONS_TABLE = $ActionsTable
  STEPS_QUEUE_URL = $QueueUrl
  GLAZYR_RUNTIME_API_KEY = $RuntimeApiKey
}

# Pass Google Vision creds to the ingest lambda (optional; can be set manually in Lambda env vars too).
$visionJson = ""
if ($GoogleVisionServiceAccountJsonFile) {
  if (-not (Test-Path -LiteralPath $GoogleVisionServiceAccountJsonFile)) { throw "GoogleVisionServiceAccountJsonFile not found: $GoogleVisionServiceAccountJsonFile" }
  # Read as a plain string (avoids odd object coercions that can break AWS CLI param validation).
  $resolved = (Resolve-Path -LiteralPath $GoogleVisionServiceAccountJsonFile).Path
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $visionJson = [System.IO.File]::ReadAllText($resolved, $utf8NoBom)
} elseif ($GoogleVisionServiceAccountJson) {
  $visionJson = $GoogleVisionServiceAccountJson
} else {
  $visionJson = $env:GOOGLE_VISION_SERVICE_ACCOUNT_JSON
}
if ($visionJson) {
  $EnvVars["GOOGLE_VISION_SERVICE_ACCOUNT_JSON"] = $visionJson
}

function Upsert-Lambda($fnName, $zipPath, $handler) {
  try {
    Invoke-Aws "lambda get-function --region $Region --function-name $fnName" | Out-Null
    Invoke-Aws "lambda update-function-code --region $Region --function-name $fnName --zip-file fileb://$zipPath" | Out-Null
    Invoke-Aws "lambda wait function-updated --region $Region --function-name $fnName" | Out-Null
  } catch {
    # IAM role propagation can cause "role cannot be assumed" for a short period.
    $created = $false
    for ($i = 0; $i -lt 8; $i++) {
      try {
        Invoke-Aws "lambda create-function --region $Region --function-name $fnName --runtime nodejs20.x --role $RoleArn --handler $handler --timeout 15 --memory-size 256 --zip-file fileb://$zipPath" | Out-Null
        $created = $true
        Invoke-Aws "lambda wait function-active --region $Region --function-name $fnName" | Out-Null
        break
      } catch {
        if ($i -ge 7) { throw }
        Start-Sleep -Seconds 10
      }
    }
    if (-not $created) { throw "Failed to create lambda $fnName" }
  }

  # Set env vars (merge with existing to avoid wiping secrets when optional vars aren't provided).
  $merged = @{}
  try {
    $existingJson = Invoke-Aws "lambda get-function-configuration --region $Region --function-name $fnName --query Environment.Variables --output json"
    if ($existingJson) {
      $existing = $existingJson | ConvertFrom-Json -ErrorAction SilentlyContinue
      if ($existing -and $existing.PSObject.Properties.Count -gt 0) {
        foreach ($p in $existing.PSObject.Properties) { $merged[$p.Name] = [string]$p.Value }
      }
    }
  } catch {
    # ignore: if we can't read existing env vars, fall back to setting only $EnvVars
  }
  foreach ($k in $EnvVars.Keys) { $merged[$k] = [string]$EnvVars[$k] }

  $envDoc = @{ Variables = $merged } | ConvertTo-Json -Compress
  $envPath = Write-TempJson $envDoc
  $envUri = To-FileUri $envPath
  for ($i = 0; $i -lt 8; $i++) {
    try {
      Invoke-Aws "lambda update-function-configuration --region $Region --function-name $fnName --environment $envUri" | Out-Null
      Invoke-Aws "lambda wait function-updated --region $Region --function-name $fnName" | Out-Null
      break
    } catch {
      if ($i -ge 7) { throw }
      Start-Sleep -Seconds 5
    }
  }
}

Upsert-Lambda $IngestFn $IngestZip "index.handler"
Upsert-Lambda $WorkerFn $WorkerZip "index.handler"

# --- Function URL for ingest ---
Write-Host "Ensuring Function URL for ingest..."
try {
  $FnUrl = (& aws lambda get-function-url-config --region $Region --function-name $IngestFn --query "FunctionUrl" --output text)
  if ($LASTEXITCODE -ne 0) { throw "get-function-url-config failed" }
} catch {
  $FnUrl = (& aws lambda create-function-url-config --region $Region --function-name $IngestFn --auth-type NONE --query "FunctionUrl" --output text)
  if ($LASTEXITCODE -ne 0) { throw "create-function-url-config failed" }
}
Write-Host "Ingest Function URL: $FnUrl"

# Allow public invoke (since Function URL auth is NONE; we enforce key in code if provided)
try {
  Invoke-Aws "lambda add-permission --region $Region --function-name $IngestFn --statement-id FunctionUrlPublicAccess --action lambda:InvokeFunctionUrl --principal * --function-url-auth-type NONE" | Out-Null
} catch {
  # permission may already exist
}

# --- SQS trigger for worker ---
Write-Host "Ensuring SQS trigger mapping..."
$Existing = (& aws lambda list-event-source-mappings --region $Region --function-name $WorkerFn --event-source-arn $QueueArn --query "EventSourceMappings[0].UUID" --output text)
if (-not $Existing -or $Existing -eq "None") {
  Invoke-Aws "lambda create-event-source-mapping --region $Region --function-name $WorkerFn --event-source-arn $QueueArn --batch-size 1 --enabled" | Out-Null
}

Write-Host ""
Write-Host "Done."
Write-Host "Use these endpoints (Function URL base):"
Write-Host "  POST $FnUrl/runtime/task/start"
Write-Host "  POST $FnUrl/runtime/vision/ocr"
Write-Host "  GET  $FnUrl/runtime/next-action?deviceId=<device>"
Write-Host "  POST $FnUrl/runtime/action-result"
Write-Host ""
Write-Host "If RuntimeApiKey is set, include header: x-glazyr-api-key: <key>"

