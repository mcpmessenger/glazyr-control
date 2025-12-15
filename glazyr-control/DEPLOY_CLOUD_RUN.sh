#!/bin/bash
# Quick deploy script for GCP Cloud Run

set -e

PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="glazyr-control"

echo "🚀 Deploying glazyr-control to Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

# Build and push image
echo "📦 Building and pushing Docker image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .

# Check if secret exists
if gcloud secrets describe openai-api-key &> /dev/null; then
    echo "✅ Using existing secret: openai-api-key"
    USE_SECRET=true
else
    echo "⚠️  Secret 'openai-api-key' not found. Using env var instead."
    echo "   Create it with: echo -n 'your-key' | gcloud secrets create openai-api-key --data-file=-"
    USE_SECRET=false
fi

# Deploy
echo "🚀 Deploying to Cloud Run..."

if [ "$USE_SECRET" = true ]; then
    gcloud run deploy $SERVICE_NAME \
      --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
      --platform managed \
      --region $REGION \
      --allow-unauthenticated \
      --port 8000 \
      --memory 1Gi \
      --timeout 300 \
      --max-instances 10 \
      --update-secrets OPENAI_API_KEY=openai-api-key:latest \
      --set-env-vars PROMETHEUS_ENABLED="true" \
      --set-env-vars SENTRY_ENABLED="false"
else
    read -sp "Enter OpenAI API key: " OPENAI_KEY
    echo ""
    gcloud run deploy $SERVICE_NAME \
      --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
      --platform managed \
      --region $REGION \
      --allow-unauthenticated \
      --port 8000 \
      --memory 1Gi \
      --timeout 300 \
      --max-instances 10 \
      --set-env-vars OPENAI_API_KEY="$OPENAI_KEY" \
      --set-env-vars PROMETHEUS_ENABLED="true" \
      --set-env-vars SENTRY_ENABLED="false"
fi

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")

echo ""
echo "✅ Deployment complete!"
echo "📍 Service URL: $SERVICE_URL"
echo ""
echo "Test it:"
echo "  curl $SERVICE_URL/healthz"
echo "  curl $SERVICE_URL/metrics"
echo ""
echo "Configure extension with:"
echo "  /runtime url $SERVICE_URL"
