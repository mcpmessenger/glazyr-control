# Deploy Valuation Workaround to Lambda

**Status:** ✅ Workaround implemented in code  
**Next Step:** Deploy updated code to AWS Lambda

---

## Quick Answer

Yes, `glazyr-control` is deployed as **AWS Lambda** using AWS SAM (Serverless Application Model).

To get the workaround live, you need to **redeploy** the Lambda function with the updated code.

---

## Deployment Steps

### Option 1: Quick Deploy (Recommended)

```powershell
cd glazyr-control

# If you have DEPLOY_NOW.ps1 script
.\DEPLOY_NOW.ps1 -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX"
```

### Option 2: Standard Deploy Script

```powershell
cd glazyr-control

.\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage dev `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX"
```

### Option 3: Manual SAM Deploy

If the scripts don't work, use SAM directly:

```powershell
cd glazyr-control

# Build
sam build --use-container

# Deploy (replace with your secret ARN)
sam deploy `
  --stack-name glazyr-control-dev `
  --region us-east-1 `
  --parameter-overrides OpenAIKeySecretArn="arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX" `
  --capabilities CAPABILITY_IAM `
  --resolve-s3
```

---

## What Gets Deployed

The deployment includes:
- ✅ Updated `src/mcp.py` with the valuation workaround
- ✅ All dependencies from `requirements.txt`
- ✅ FastAPI application wrapped for Lambda
- ✅ Function URL for HTTP access

---

## After Deployment

### 1. Get Your Function URL

The deployment script will output the Function URL. Or get it manually:

```powershell
aws cloudformation describe-stacks `
  --region us-east-1 `
  --stack-name glazyr-control-dev `
  --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" `
  --output text
```

### 2. Update Extension (If Needed)

If your extension is pointing to a different URL, update it:

```
/runtime url https://your-function-url.lambda-url.us-east-1.on.aws
```

### 3. Test the Workaround

Try in your extension:

```
/valuation what's the unicorn score for https://github.com/mcpmessenger/slashmcp?
```

**Expected:** Should return actual unicorn score (not "I don't have access")

---

## Prerequisites

Before deploying, make sure you have:

1. **AWS CLI configured:**
   ```powershell
   aws configure
   aws sts get-caller-identity  # Test credentials
   ```

2. **AWS SAM CLI installed:**
   ```powershell
   sam --version
   ```
   If not installed: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

3. **OpenAI API Key Secret:**
   ```powershell
   # Create if it doesn't exist
   aws secretsmanager create-secret `
     --name glazyr-control/openai-api-key `
     --secret-string "sk-your-key-here" `
     --region us-east-1
   
   # Get ARN if it exists
   aws secretsmanager describe-secret `
     --secret-id glazyr-control/openai-api-key `
     --region us-east-1 `
     --query "ARN" `
     --output text
   ```

4. **IAM Permissions:**
   - Lambda (create, update, invoke)
   - CloudFormation (create/update stacks)
   - S3 (for SAM build artifacts)
   - Secrets Manager (read secret)
   - IAM (create roles)

---

## Troubleshooting

### "Secret not found"
- Make sure the secret ARN is correct
- Secret must exist in the same region you're deploying to
- You need permissions to read the secret

### "Build fails"
- Make sure Docker is running (for `--use-container`)
- Python 3.12 should be available
- Check `requirements.txt` has all dependencies

### "Deployment fails"
- Check AWS credentials: `aws sts get-caller-identity`
- Verify IAM permissions
- Check CloudFormation stack status: `aws cloudformation describe-stacks --stack-name glazyr-control-dev`

### "Function URL not working"
- Wait a few seconds after deployment (propagation delay)
- Check Lambda function logs: `aws logs tail /aws/lambda/glazyr-control-dev --follow`
- Test health endpoint: `curl https://your-function-url.lambda-url.us-east-1.on.aws/healthz`

---

## Local Testing (Before Deploy)

You can test locally first:

```powershell
cd glazyr-control

# Install dependencies
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Set environment variables
$env:OPENAI_API_KEY = "sk-your-key-here"
$env:VALUATION_MCP_URL = "https://valuation-mcp-server-554655392699.us-central1.run.app"

# Run locally
uvicorn src.main:app --reload --port 8000
```

Then test:
```powershell
# Test health
curl http://localhost:8000/healthz

# Test valuation workaround
$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "/valuation what's the unicorn score for https://github.com/mcpmessenger/slashmcp?"
    }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "http://localhost:8000/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

---

## Summary

1. ✅ **Code is ready** - Workaround implemented in `src/mcp.py`
2. ⏳ **Deploy to Lambda** - Use `deploy-sam.ps1` or `DEPLOY_NOW.ps1`
3. ✅ **Test** - Try `/valuation` commands in extension
4. 🎉 **Done!** - Workaround should work

---

**Need Help?** See:
- `QUICK_DEPLOY_LAMBDA.md` - Quick deployment guide
- `LAMBDA_DEPLOYMENT.md` - Detailed deployment instructions
- `DEPLOY_BACKEND.md` - Backend deployment overview

