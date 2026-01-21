# Install AWS SAM CLI

You need AWS SAM CLI to deploy to Lambda. Here's how to install it on Windows:

## Option 1: Install via MSI (Easiest)

1. Download the installer from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
2. Run the `.msi` installer
3. Restart your terminal/PowerShell
4. Verify: `sam --version`

## Option 2: Install via Chocolatey (If you have it)

```powershell
choco install aws-sam-cli
```

Then restart your terminal and verify: `sam --version`

## Option 3: Install via Python pip

```powershell
pip install aws-sam-cli
```

## After Installation

Once SAM CLI is installed, you can deploy with:

```powershell
cd glazyr-control
.\deploy-sam.ps1 -Region us-east-1 -Stage dev -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:396608803476:secret:glazyr-control/openai-api-key-bzJJlj"
```

## Note

You'll also need **Docker Desktop** installed and running, as SAM uses Docker containers to build Python applications.
