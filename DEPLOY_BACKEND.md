# Deploy Backend for Dashboard

Quick guide to deploy `glazyr-control` to AWS Lambda so the dashboard can connect to it.

## Step 1: Create OpenAI API Key Secret

First, store your OpenAI API key in AWS Secrets Manager:

```powershell
aws secretsmanager create-secret `
  --name glazyr-control/openai-api-key `
  --secret-string "sk-your-openai-key-here" `
  --region us-east-1
```

**Copy the ARN from the output** - you'll need it in Step 2.

Example ARN format:
```
arn:aws:secretsmanager:us-east-1:123456789012:secret:glazyr-control/openai-api-key-AbCdEf
```

## Step 2: Deploy to Lambda

### Option A: Use the Quick Deploy Script (Recommended)

```powershell
cd glazyr-control

.\DEPLOY_NOW.ps1 -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX"
```

### Option B: Use the Standard Deploy Script

```powershell
cd glazyr-control

.\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage dev `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX"
```

## Step 3: Configure Dashboard

After deployment, you'll get a Function URL. Configure the dashboard to use it:

```powershell
cd glazyr-main

# Create/edit .env.local
echo GLAZYR_CONTROL_RUNTIME_URL=https://your-function-url.lambda-url.us-east-1.on.aws > .env.local

# If you set an API key during deployment, add it:
echo GLAZYR_CONTROL_RUNTIME_API_KEY=your-api-key >> .env.local
```

## Step 4: Restart Dashboard

Restart the Next.js dev server:

```powershell
cd glazyr-main
npm run dev
```

The dashboard will now connect to the deployed Lambda function!

## Quick Test

Test the deployed function:

```powershell
# Health check
curl https://your-function-url.lambda-url.us-east-1.on.aws/healthz

# MCP Manifest
curl https://your-function-url.lambda-url.us-east-1.on.aws/mcp/manifest
```

## Troubleshooting

### Secret Not Found

If you get "Secret not found" error, make sure:
1. The secret ARN is correct
2. The secret exists in the same region you're deploying to
3. You have permissions to read the secret

### Build Fails

Make sure you have:
- Docker installed (for `sam build --use-container`)
- Python 3.12 available
- All dependencies in `requirements.txt`

### Deployment Fails

Check:
- AWS credentials are configured: `aws sts get-caller-identity`
- You have IAM permissions for Lambda, CloudFormation, S3, Secrets Manager
- The region exists and is accessible

## Get Function URL After Deployment

If you need to retrieve the URL later:

```powershell
aws cloudformation describe-stacks `
  --region us-east-1 `
  --stack-name glazyr-control-dev `
  --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" `
  --output text
```

## Production Deployment

For production, add API key authentication:

```powershell
.\DEPLOY_NOW.ps1 `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:..." `
  -Stage prod `
  -ApiKey "your-secure-api-key-here"
```
