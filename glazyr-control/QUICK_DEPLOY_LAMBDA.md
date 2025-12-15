# Quick Deploy to AWS Lambda

The fastest way to deploy glazyr-control to AWS Lambda.

## Prerequisites

- AWS CLI configured: `aws configure`
- AWS SAM CLI installed: `sam --version`
- IAM permissions: Lambda, Secrets Manager, CloudFormation, S3

## 3-Step Deployment

### Step 1: Create Secret

```powershell
aws secretsmanager create-secret `
  --name glazyr-control/openai-api-key `
  --secret-string "sk-your-openai-key-here" `
  --region us-east-1
```

**Copy the ARN from output** (e.g., `arn:aws:secretsmanager:us-east-1:123456789012:secret:glazyr-control/openai-api-key-AbCdEf`)

### Step 2: Deploy

```powershell
cd glazyr-control

.\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage dev `
  -OpenAIKeySecretArn "PASTE_ARN_HERE"
```

### Step 3: Get URL

The script outputs the Function URL. Or get it manually:

```powershell
aws cloudformation describe-stacks `
  --region us-east-1 `
  --stack-name glazyr-control-dev `
  --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" `
  --output text
```

## Configure Extension

In your Chrome extension, set the runtime URL:

```
/runtime url https://your-function-url.lambda-url.us-east-1.on.aws
```

## Production Deployment

For production, add API key auth:

```powershell
.\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage prod `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:..." `
  -ApiKey "your-secure-api-key-here"
```

Then configure extension with API key:

```
/runtime url https://your-function-url.lambda-url.us-east-1.on.aws
/runtime key your-secure-api-key-here
```

## That's It!

Your service is now live. Test it:

```powershell
curl https://your-function-url.lambda-url.us-east-1.on.aws/healthz
```

For detailed instructions, troubleshooting, and advanced configuration, see [LAMBDA_DEPLOYMENT.md](./LAMBDA_DEPLOYMENT.md).
