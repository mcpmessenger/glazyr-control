# Next Steps - Deploy Backend

## Current Status ✅
- ✅ AWS Secrets Manager secret created
- ✅ IAM permissions granted
- ⚠️ SAM CLI needs to be accessible

## Future Roadmap 🚀

### Phase 4: Web 3 Integration
- **Integrate Real Crypto Wallet**: Replace the mock `agentWallet` in `UCPHandler.ts` with a real Web 3 wallet (e.g., using `ethers.js` or `viem`).
- **Blockchain Network**: Target Base (Coinbase L2) or Ethereum for payment settlement.
- **Smart Contracts**: Deploy payment channel contracts for UCP.

## Step 1: Find/Install SAM CLI

### Option A: If SAM is installed somewhere
Try finding it:
```powershell
# Check if it's in a venv or Python location
python -m samcli --version
# or
py -m samcli --version
```

### Option B: Install SAM CLI (if not found)
**Windows (MSI):**
1. Download: https://github.com/aws/aws-sam-cli/releases/latest
2. Download `AWSSAMCLISetup.exe`
3. Install it
4. **Restart PowerShell**
5. Test: `sam --version`

**OR via pip (if you have Python):**
```powershell
pip install aws-sam-cli
sam --version
```

**Also need Docker Desktop:**
- Download: https://www.docker.com/products/docker-desktop
- Install and start Docker Desktop

## Step 2: Deploy to Lambda

Once SAM CLI works:

```powershell
cd glazyr-control
.\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage dev `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:396608803476:secret:glazyr-control/openai-api-key-bzJJlj"
```

This will:
- Build the Lambda package
- Deploy to AWS Lambda
- Output the Function URL

## Step 3: Configure Dashboard

After deployment, you'll get a Function URL like:
```
https://xxxxx.lambda-url.us-east-1.on.aws
```

Configure the dashboard:

```powershell
cd glazyr-main

# Create .env.local with the Function URL
echo GLAZYR_CONTROL_RUNTIME_URL=https://your-function-url.lambda-url.us-east-1.on.aws > .env.local

# Restart Next.js dev server
npm run dev
```

## Step 4: Test It!

1. Open dashboard: http://localhost:3000/dashboard
2. The dashboard should now connect to the deployed Lambda backend
3. Test an agent query if available

---

**Quick Test Commands:**

```powershell
# Test health endpoint
curl https://your-function-url.lambda-url.us-east-1.on.aws/healthz

# Test MCP manifest
curl https://your-function-url.lambda-url.us-east-1.on.aws/mcp/manifest
```
