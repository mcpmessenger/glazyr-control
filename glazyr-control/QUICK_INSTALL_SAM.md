# Quick Install SAM CLI - Step by Step

**Status:** SAM CLI is NOT installed yet

---

## Installation Steps

### Step 1: Download

**Direct Download Link:**
```
https://github.com/aws/aws-sam-cli/releases/download/v1.150.1/AWS_SAM_CLI_64_PY3.msi
```

Or go to: https://github.com/aws/aws-sam-cli/releases/tag/v1.150.1

**File to download:** `AWS_SAM_CLI_64_PY3.msi`

---

### Step 2: Install

1. Open the downloaded `.msi` file
2. Click "Next" through the installation wizard
3. Accept the default installation location
4. Click "Install"
5. Wait for installation to complete

---

### Step 3: Restart Terminal

**CRITICAL:** Close and reopen your PowerShell terminal.

PATH changes only take effect in new terminal sessions.

---

### Step 4: Verify

Open a NEW PowerShell window and run:

```powershell
sam --version
```

You should see:
```
SAM CLI, version 1.150.1
```

If you see an error, the terminal wasn't restarted or installation failed.

---

### Step 5: Deploy

Once SAM CLI is verified, deploy the valuation workaround:

```powershell
cd glazyr-control

# Make sure you're NOT in venv
deactivate  # if needed

# Deploy
.\deploy-aws-cli.ps1 -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX"
```

---

## Troubleshooting

### Still says "sam: command not found" after restart

1. **Check if SAM is installed:**
   ```powershell
   Test-Path "C:\Program Files\Amazon\SAM CLI\bin\sam.cmd"
   ```

2. **If it exists but not in PATH:**
   - Manually add to PATH, or
   - Restart your computer

3. **If it doesn't exist:**
   - Installation may have failed
   - Check Windows Event Viewer for errors
   - Try installing again

---

## Current Status

- ❌ SAM CLI: Not installed
- ✅ AWS CLI: Should be installed (check with `aws --version`)
- ⏳ Next: Install SAM CLI, then deploy

---

**After installing SAM CLI and restarting terminal, you'll be ready to deploy!**
