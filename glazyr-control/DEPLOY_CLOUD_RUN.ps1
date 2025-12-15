# PowerShell script to deploy glazyr-control to GCP Cloud Run

param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectId = "your-project-id",
    
    [Parameter(Mandatory = $false)]
    [string]$Region = "us-central1",
    
    [Parameter(Mandatory = $false)]
    [string]$ServiceName = "glazyr-control"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying glazyr-control to Cloud Run..." -ForegroundColor Cyan
Write-Host "Project: $ProjectId" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow

# Check if gcloud is installed
try {
    gcloud --version | Out-Null
} catch {
    Write-Host "❌ gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    exit 1
}

# Set project
Write-Host "`n📋 Setting GCP project..." -ForegroundColor Cyan
gcloud config set project $ProjectId

# Build and push image
Write-Host "`n📦 Building and pushing Docker image..." -ForegroundColor Cyan
gcloud builds submit --tag "gcr.io/$ProjectId/$ServiceName`:latest" .

# Check if secret exists
$secretExists = $false
try {
    gcloud secrets describe openai-api-key --project $ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $secretExists = $true
        Write-Host "✅ Using existing secret: openai-api-key" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Secret 'openai-api-key' not found. Will use env var instead." -ForegroundColor Yellow
    Write-Host "   Create it with: echo -n 'your-key' | gcloud secrets create openai-api-key --data-file=-" -ForegroundColor Yellow
}

# Deploy
Write-Host "`n🚀 Deploying to Cloud Run..." -ForegroundColor Cyan

if ($secretExists) {
    gcloud run deploy $ServiceName `
      --image "gcr.io/$ProjectId/$ServiceName`:latest" `
      --platform managed `
      --region $Region `
      --allow-unauthenticated `
      --port 8000 `
      --memory 1Gi `
      --timeout 300 `
      --max-instances 10 `
      --update-secrets "OPENAI_API_KEY=openai-api-key:latest" `
      --set-env-vars "PROMETHEUS_ENABLED=true" `
      --set-env-vars "SENTRY_ENABLED=false"
} else {
    $openaiKey = Read-Host "Enter OpenAI API key" -AsSecureString
    $openaiKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($openaiKey)
    )
    
    gcloud run deploy $ServiceName `
      --image "gcr.io/$ProjectId/$ServiceName`:latest" `
      --platform managed `
      --region $Region `
      --allow-unauthenticated `
      --port 8000 `
      --memory 1Gi `
      --timeout 300 `
      --max-instances 10 `
      --set-env-vars "OPENAI_API_KEY=$openaiKeyPlain" `
      --set-env-vars "PROMETHEUS_ENABLED=true" `
      --set-env-vars "SENTRY_ENABLED=false"
}

# Get service URL
$serviceUrl = gcloud run services describe $ServiceName --region $Region --format="value(status.url)"

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "📍 Service URL: $serviceUrl" -ForegroundColor Cyan
Write-Host "`nTest it:" -ForegroundColor Yellow
Write-Host "  curl $serviceUrl/healthz"
Write-Host "  curl $serviceUrl/metrics"
Write-Host "`nConfigure extension with:" -ForegroundColor Yellow
Write-Host "  /runtime url $serviceUrl"
