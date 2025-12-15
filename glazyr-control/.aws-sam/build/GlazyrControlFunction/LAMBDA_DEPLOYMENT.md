# AWS Lambda Deployment Guide

This guide covers deploying `glazyr-control` to AWS Lambda using AWS SAM (Serverless Application Model).

## Prerequisites

- AWS CLI configured (`aws configure`)
- AWS SAM CLI installed (`sam --version`)
- IAM permissions: Lambda, Secrets Manager, CloudFormation, S3, IAM
- Python 3.12 (for local testing only)

## Quick Deploy

```powershell
cd glazyr-control

# Deploy to dev environment
.\deploy-sam.ps1 -Region us-east-1 -Stage dev -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX"
```

## Step-by-Step Deployment

### Step 1: Create OpenAI API Key Secret

First, store your OpenAI API key in AWS Secrets Manager:

```powershell
# Create the secret
aws secretsmanager create-secret `
  --name glazyr-control/openai-api-key `
  --secret-string "sk-your-openai-key-here" `
  --region us-east-1

# Note the ARN from the output (you'll need it in Step 2)
# Example: arn:aws:secretsmanager:us-east-1:123456789012:secret:glazyr-control/openai-api-key-AbCdEf
```

**Alternative**: If the secret already exists, get its ARN:

```powershell
aws secretsmanager describe-secret `
  --secret-id glazyr-control/openai-api-key `
  --region us-east-1 `
  --query "ARN" `
  --output text
```

### Step 2: Deploy with SAM

```powershell
cd glazyr-control

# Basic deployment (no API key auth)
.\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage dev `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX"

# Production deployment with API key auth
.\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage prod `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX" `
  -ApiKey "your-secure-api-key-here" `
  -PayloadMaxBytes 5242880 `
  -AllowedDomains "example.com,api.example.com"
```

### Step 3: Get Function URL

After deployment, the script outputs the Function URL:

```
https://xxxxxxxxxx.lambda-url.us-east-1.on.aws
```

Alternatively, get it manually:

```powershell
aws cloudformation describe-stacks `
  --region us-east-1 `
  --stack-name glazyr-control-dev `
  --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" `
  --output text
```

### Step 4: Configure Extension

Update your Chrome extension to use the Lambda Function URL:

```
/runtime url https://xxxxxxxxxx.lambda-url.us-east-1.on.aws
/runtime key your-api-key  # if ApiKey was set
```

## Deployment Parameters

| Parameter | Description | Default | Required |
|-----------|-------------|---------|----------|
| `Region` | AWS region to deploy to | `us-east-1` | No |
| `Stage` | Environment name (dev/staging/prod) | `dev` | No |
| `ServiceName` | Service name prefix | `glazyr-control` | No |
| `OpenAIKeySecretArn` | Secrets Manager ARN for OpenAI key | `""` | **Yes** (for production) |
| `ApiKey` | Client API key for auth | `""` | No (recommended for prod) |
| `OpenAIModel` | OpenAI model to use | `gpt-4o-mini` | No |
| `AllowedDomains` | Domain allowlist (comma-separated) | `""` | No |
| `PayloadMaxBytes` | Max request size in bytes | `5242880` (5MB) | No |

## Lambda Configuration

### Current Settings

- **Runtime**: Python 3.12
- **Timeout**: 30 seconds
- **Memory**: 512 MB
- **Architecture**: x86_64
- **Function URL**: Enabled with CORS

### Adjusting Settings

Edit `template.yaml` to change:

```yaml
Globals:
  Function:
    Timeout: 60          # Increase for longer agent runs
    MemorySize: 1024     # Increase for complex queries
```

Then redeploy.

## Environment Variables

The Lambda function receives these environment variables:

| Variable | Source | Description |
|----------|--------|-------------|
| `API_KEY` | SAM Parameter | Client API key (if set) |
| `PAYLOAD_MAX_BYTES` | SAM Parameter | Request size limit |
| `ALLOWED_DOMAINS` | SAM Parameter | Domain allowlist |
| `OPENAI_API_KEY_SECRET_ARN` | SAM Parameter | Secret ARN (read at runtime) |
| `OPENAI_MODEL` | SAM Parameter | OpenAI model name |

**Note**: The OpenAI API key is **not** set as an environment variable. Instead, `secrets.py` reads it from Secrets Manager at runtime using the ARN.

## Secrets Manager Integration

The Lambda function automatically retrieves the OpenAI API key from Secrets Manager using the ARN provided in `OPENAI_API_KEY_SECRET_ARN`.

The IAM role created by SAM includes `secretsmanager:GetSecretValue` permission for the specified secret ARN.

## Testing Deployment

```powershell
# Health check
curl https://your-function-url.lambda-url.us-east-1.on.aws/healthz

# MCP Manifest
curl https://your-function-url.lambda-url.us-east-1.on.aws/mcp/manifest

# Test invocation (if API key is set)
curl -X POST https://your-function-url.lambda-url.us-east-1.on.aws/mcp/invoke `
  -H "Content-Type: application/json" `
  -H "x-glazyr-api-key: your-api-key" `
  -d '{"tool": "agent_executor", "input": {"input": "Hello, world!"}}'
```

## Updating Deployment

To update an existing deployment:

```powershell
# Just run the deploy script again
.\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage dev `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:..."
```

SAM will detect changes and update only what's needed.

## Monitoring

### CloudWatch Logs

All Lambda logs automatically go to CloudWatch:

```
/aws/lambda/glazyr-control-dev
```

View logs:

```powershell
aws logs tail /aws/lambda/glazyr-control-dev --follow --region us-east-1
```

### CloudWatch Metrics

Built-in metrics available in CloudWatch:
- Invocations
- Duration
- Errors
- Throttles

### Prometheus Metrics

The `/metrics` endpoint is available, but Lambda doesn't support long-running Prometheus scraping. Use:

1. **CloudWatch Exporter**: Export CloudWatch metrics to Prometheus
2. **Lambda Extension**: Use a Lambda extension for metrics (advanced)

### Sentry Integration

Sentry works in Lambda. Set environment variables:

```yaml
# In template.yaml Environment.Variables
SENTRY_DSN: "https://your-dsn@sentry.io/project-id"
SENTRY_ENABLED: "true"
SENTRY_ENVIRONMENT: "prod"
```

Then update `deploy-sam.ps1` to pass these as parameters, or add them directly to `template.yaml`.

## Cost Estimation

### Free Tier

- **1M requests/month** free
- **400,000 GB-seconds compute** free

### After Free Tier

- **$0.20 per million requests**
- **$0.0000166667 per GB-second**

### Example Monthly Cost

| Requests/Month | Duration (avg) | Cost |
|----------------|----------------|------|
| 100k | 2s | Free (within free tier) |
| 1M | 2s | ~$0.20 |
| 10M | 2s | ~$2.00 + $0.27 compute = ~$2.27 |

**For MVP/Demo**: Essentially free (within free tier).

## Troubleshooting

### Error: `sam build` fails

**Cause**: Missing dependencies or Python version mismatch.

**Solution**:
```powershell
# Ensure you're in the glazyr-control directory
cd glazyr-control

# Try building without container first
sam build

# If that fails, ensure requirements.txt is correct
pip install -r requirements.txt
```

### Error: `Could not find handler`

**Cause**: Lambda can't find the handler function.

**Solution**: Ensure `template.yaml` has:
```yaml
Handler: src.lambda_handler.handler
```

And `src/lambda_handler.py` exists with:
```python
from mangum import Mangum
from .main import app
handler = Mangum(app)
```

### Error: `Timeout` in CloudWatch Logs

**Cause**: Agent execution takes longer than 30 seconds.

**Solution**: Increase timeout in `template.yaml`:
```yaml
Globals:
  Function:
    Timeout: 60  # or 300 (max 15 minutes for Lambda)
```

### Error: `OPENAI_API_KEY is not set`

**Cause**: Secret ARN is incorrect or Lambda doesn't have permission.

**Solution**:
1. Verify secret exists: `aws secretsmanager describe-secret --secret-id glazyr-control/openai-api-key`
2. Verify ARN is correct in deployment
3. Check CloudWatch logs for permission errors

### Error: Cold Start Too Slow

**Cause**: First request after idle period takes 1-3 seconds to initialize.

**Solution**: 
- Use **Provisioned Concurrency** (costs extra)
- Or accept cold starts (they're usually acceptable for async use cases)

## Multiple Environments

Deploy to multiple stages:

```powershell
# Dev
.\deploy-sam.ps1 -Stage dev -OpenAIKeySecretArn "arn:aws:secretsmanager:..." -Region us-east-1

# Staging
.\deploy-sam.ps1 -Stage staging -OpenAIKeySecretArn "arn:aws:secretsmanager:..." -Region us-east-1

# Production
.\deploy-sam.ps1 -Stage prod -OpenAIKeySecretArn "arn:aws:secretsmanager:..." -ApiKey "prod-key" -Region us-east-1
```

Each creates a separate stack: `glazyr-control-dev`, `glazyr-control-staging`, `glazyr-control-prod`.

## Cleanup

To delete a deployment:

```powershell
aws cloudformation delete-stack `
  --stack-name glazyr-control-dev `
  --region us-east-1
```

**Note**: This does NOT delete the Secrets Manager secret. Delete it separately if needed:

```powershell
aws secretsmanager delete-secret `
  --secret-id glazyr-control/openai-api-key `
  --force-delete-without-recovery `
  --region us-east-1
```

## Security Best Practices

- ✅ **Use Secrets Manager** for API keys (never hardcode)
- ✅ **Enable API key auth** in production (`ApiKey` parameter)
- ✅ **Set domain allowlist** if making external calls
- ✅ **Set payload limits** to prevent abuse
- ✅ **Use IAM roles** (automatic with SAM)
- ✅ **Enable CloudWatch logging** (automatic)
- ✅ **Monitor costs** via AWS Cost Explorer

## Next Steps

1. ✅ Deploy to `dev` environment
2. ✅ Test with extension
3. ✅ Monitor CloudWatch logs
4. ✅ Deploy to `prod` with API key auth
5. ✅ Set up CloudWatch alarms for errors
6. ✅ Configure custom domain (optional)

## Related Documentation

- **README.md**: General project overview
- **PRODUCTION_DEPLOYMENT.md**: Comparison with other platforms
- **OBSERVABILITY_SETUP.md**: Prometheus/Sentry setup (for advanced use)
