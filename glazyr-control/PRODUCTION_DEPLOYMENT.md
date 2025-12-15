# Production Deployment Guide

This guide covers deploying glazyr-control to various production platforms for demo/MVP/production use.

## Deployment Options Comparison

| Platform | Best For | Cost | Ease | Scalability |
|----------|----------|------|------|-------------|
| **GCP Cloud Run** | MVP/Demo/Production | Low (pay per use) | ⭐⭐⭐⭐⭐ | Auto-scales |
| **AWS Lambda** | Cost optimization | Very Low | ⭐⭐⭐ | Auto-scales |
| **Docker** | On-premise, custom | Varies | ⭐⭐⭐⭐ | Manual/Orchestrator |
| **Railway/Render** | Quick MVP | Low | ⭐⭐⭐⭐⭐ | Auto-scales |

## Option 1: GCP Cloud Run (Recommended for MVP/Demo) ⭐

Cloud Run is perfect for FastAPI apps - it's serverless, auto-scales, and very affordable.

### Prerequisites

```bash
# Install gcloud CLI
# https://cloud.google.com/sdk/docs/install

# Login and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Step 1: Build and Push Docker Image

```bash
cd glazyr-control

# Build Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/glazyr-control:latest .

# Push to Google Container Registry
gcloud auth configure-docker
docker push gcr.io/YOUR_PROJECT_ID/glazyr-control:latest
```

Or use Cloud Build (easier):

```bash
# Build and push in one command
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/glazyr-control:latest .
```

### Step 2: Deploy to Cloud Run

```bash
gcloud run deploy glazyr-control \
  --image gcr.io/YOUR_PROJECT_ID/glazyr-control:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8000 \
  --memory 1Gi \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars OPENAI_API_KEY="your-openai-key" \
  --set-env-vars PROMETHEUS_ENABLED="true"
```

**With Secrets (Recommended for Production):**

```bash
# 1. Create secret in Secret Manager
echo -n "your-openai-key" | gcloud secrets create openai-api-key --data-file=-

# 2. Grant Cloud Run access
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 3. Deploy with secret reference
gcloud run deploy glazyr-control \
  --image gcr.io/YOUR_PROJECT_ID/glazyr-control:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8000 \
  --memory 1Gi \
  --timeout 300 \
  --update-secrets OPENAI_API_KEY=openai-api-key:latest \
  --set-env-vars PROMETHEUS_ENABLED="true"
```

### Step 3: Get Service URL

After deployment, Cloud Run provides a URL:

```
https://glazyr-control-XXXXX-uc.a.run.app
```

Use this URL in your extension configuration!

### Step 4: Optional - Custom Domain

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service glazyr-control \
  --domain api.yourdomain.com \
  --region us-central1
```

### Cloud Run Benefits

✅ **Serverless** - No servers to manage  
✅ **Auto-scaling** - Handles traffic spikes automatically  
✅ **Pay per use** - Only pay when handling requests (great for MVP)  
✅ **Fast cold starts** - Better than Lambda for containers  
✅ **HTTPS included** - Free SSL certificate  
✅ **Built-in monitoring** - Integrates with Cloud Monitoring

### Estimated Cost (MVP/Demo)

- **Free tier**: 2 million requests/month free
- **After free tier**: ~$0.40 per million requests
- **With traffic**: Typically $5-20/month for moderate usage

## Option 2: AWS Lambda (Already Configured)

You already have AWS Lambda deployment set up! This is great for cost optimization.

### Deploy

```powershell
cd glazyr-control

# Create OpenAI key secret
aws secretsmanager create-secret `
  --name glazyr-control/openai-api-key `
  --secret-string "your-openai-key" `
  --region us-east-1

# Deploy
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage prod `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX" `
  -ApiKey "your-client-access-key"
```

### Benefits

✅ **Ultra-low cost** - Pay per request  
✅ **Auto-scaling** - Handles any load  
✅ **No servers** - Fully serverless

### Drawbacks

⚠️ **Cold starts** - Can be 1-3 seconds  
⚠️ **15-minute timeout** - Max execution time

## Option 3: Docker + Any Platform

### Build Docker Image

```bash
cd glazyr-control
docker build -t glazyr-control:latest .
```

### Run Locally

```bash
docker run -p 8000:8000 \
  -e OPENAI_API_KEY="your-key" \
  -e PROMETHEUS_ENABLED="true" \
  glazyr-control:latest
```

### Deploy to Platform

#### Railway (Easiest for MVP)

1. Connect GitHub repo
2. Railway auto-detects Dockerfile
3. Set environment variables in dashboard
4. Deploy!

#### Render

1. Create new Web Service
2. Connect repo
3. Set Dockerfile path
4. Add environment variables
5. Deploy!

#### Fly.io

```bash
# Install flyctl
# https://fly.io/docs/getting-started/installing-flyctl/

# Deploy
fly launch
fly secrets set OPENAI_API_KEY="your-key"
fly deploy
```

## Option 4: GCP App Engine (Alternative)

```bash
# Create app.yaml
cat > app.yaml << EOF
runtime: python312
entrypoint: uvicorn src.main:app --host 0.0.0.0 --port 8080

env_variables:
  OPENAI_API_KEY: "your-key"
  PROMETHEUS_ENABLED: "true"
EOF

# Deploy
gcloud app deploy
```

## Environment Variables for Production

### Required

```bash
OPENAI_API_KEY=sk-...
```

### Optional (Recommended)

```bash
# Observability
PROMETHEUS_ENABLED=true
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENABLED=true
SENTRY_ENVIRONMENT=production

# API Security
API_KEY=your-client-access-key  # Require auth for /mcp/* and /api/*

# Policy
PAYLOAD_MAX_BYTES=5242880  # 5MB
ALLOWED_DOMAINS=example.com,api.example.com

# State
REDIS_URL=redis://your-redis-host:6379/0  # For task persistence

# Google Places (if using)
GOOGLE_PLACES_API_KEY=your-key
```

## Configuration for Extension

After deployment, update extension configuration:

### Option A: Via Extension UI

In the extension popup, type:
```
/runtime url https://your-deployed-url.com
/runtime key your-api-key
```

### Option B: Via Chrome Storage

```javascript
// In browser console (chrome://extensions > background page)
chrome.storage.local.set({
  glazyrMcpRuntimeBaseUrl: "https://your-deployed-url.com",
  glazyrMcpRuntimeApiKey: "your-api-key"
});
```

## Monitoring & Observability

### Cloud Run (GCP)

- **Metrics**: Cloud Monitoring (built-in)
- **Logs**: Cloud Logging (built-in)
- **Prometheus**: Add `/metrics` endpoint scraping
- **Sentry**: Works out of the box

### AWS Lambda

- **Metrics**: CloudWatch (built-in)
- **Logs**: CloudWatch Logs (built-in)
- **Prometheus**: Use CloudWatch exporter
- **Sentry**: Works in Lambda

## Recommended Setup for MVP/Demo

**GCP Cloud Run** is the best choice for MVP because:

1. ✅ **Easiest to deploy** - Just push Docker image
2. ✅ **Low cost** - Free tier covers most MVPs
3. ✅ **Auto-scales** - Handles demo traffic spikes
4. ✅ **Fast setup** - Deploy in 5 minutes
5. ✅ **Built-in HTTPS** - No certificate management
6. ✅ **Monitoring included** - GCP console shows metrics

### Quick Deploy Script (GCP Cloud Run)

```bash
#!/bin/bash
PROJECT_ID="your-project-id"
REGION="us-central1"

# Build and deploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/glazyr-control:latest .
gcloud run deploy glazyr-control \
  --image gcr.io/$PROJECT_ID/glazyr-control:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8000 \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars OPENAI_API_KEY="$(gcloud secrets versions access latest --secret=openai-api-key)" \
  --set-env-vars PROMETHEUS_ENABLED="true"

echo "Deployed! URL:"
gcloud run services describe glazyr-control --region $REGION --format="value(status.url)"
```

## Testing Production Deployment

```bash
# Health check
curl https://your-deployed-url.com/healthz

# Metrics
curl https://your-deployed-url.com/metrics

# MCP Manifest
curl https://your-deployed-url.com/mcp/manifest

# Test invocation
curl -X POST https://your-deployed-url.com/mcp/invoke \
  -H "Content-Type: application/json" \
  -H "x-glazyr-api-key: your-api-key" \
  -d '{"tool": "agent_executor", "input": {"input": "Hello"}}'
```

## Cost Estimates (Monthly)

### GCP Cloud Run (Recommended)
- **Free tier**: 2M requests/month
- **After free**: ~$0.40 per million requests
- **With 100k requests**: ~$0.04/month
- **With 1M requests**: ~$0.40/month

### AWS Lambda
- **Free tier**: 1M requests/month
- **After free**: $0.20 per million requests
- **Compute**: ~$0.0000166667 per GB-second

### Comparison

| Usage | Cloud Run | Lambda |
|-------|-----------|--------|
| 10k requests/month | Free | Free |
| 100k requests/month | Free | Free |
| 1M requests/month | $0.40 | $0.20 |
| 10M requests/month | $4.00 | $2.00 |

**For MVP/Demo**: Both are essentially free!

## Next Steps

1. **Choose platform** (recommend Cloud Run for MVP)
2. **Deploy** using instructions above
3. **Configure extension** with deployed URL
4. **Test** with real queries
5. **Monitor** using built-in dashboards
6. **Add Sentry** for error tracking (optional but recommended)

## Security Checklist

- [ ] API key authentication enabled (`API_KEY` env var)
- [ ] Secrets stored in Secret Manager (not env vars)
- [ ] HTTPS enabled (automatic with Cloud Run/Lambda)
- [ ] Domain allowlist configured (if needed)
- [ ] Payload size limits set
- [ ] Monitoring/alerting configured
- [ ] Error tracking (Sentry) enabled
