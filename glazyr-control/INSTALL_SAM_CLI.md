# Install AWS SAM CLI

SAM CLI is required for building Lambda packages. Here's how to install it on Windows.

---

## Option 1: Chocolatey (Recommended)

If you have Chocolatey installed:

```powershell
choco install aws-sam-cli
```

Then verify:
```powershell
sam --version
```

---

## Option 2: winget

If you have Windows Package Manager (winget):

```powershell
winget install Amazon.SAM-CLI
```

Then verify:
```powershell
sam --version
```

---

## Option 3: MSI Installer

1. Download the MSI installer from:
   https://github.com/aws/aws-sam-cli/releases/latest

2. Download `AWSSAMCLI.msi` (or latest version)

3. Run the installer

4. Verify:
   ```powershell
   sam --version
   ```

---

## Option 4: Python pip (If you have Python)

```powershell
pip install aws-sam-cli
```

Then verify:
```powershell
sam --version
```

---

## Prerequisites

SAM CLI requires:
- **Docker Desktop** (for `--use-container` builds)
  - Download: https://www.docker.com/products/docker-desktop/
  - Must be running when building

---

## Verify Installation

After installing, verify everything works:

```powershell
# Check SAM version
sam --version

# Check Docker (required for builds)
docker --version

# Test AWS credentials
aws sts get-caller-identity
```

---

## Quick Test

Once installed, you can test the build process:

```powershell
cd glazyr-control
sam build --use-container
```

If this works, you're ready to deploy!

---

## Troubleshooting

### "sam: command not found"
- Make sure SAM CLI is in your PATH
- Restart your terminal/PowerShell after installation
- On Windows, you may need to restart your computer

### "Docker is not running"
- Start Docker Desktop
- Wait for it to fully start (whale icon in system tray)
- Try again

### "Build fails"
- Make sure Docker Desktop is running
- Check Docker has enough resources allocated
- Try without `--use-container` (but this may have compatibility issues)

---

## After Installation

Once SAM CLI is installed, you can use:

```powershell
cd glazyr-control
.\deploy-aws-cli.ps1 -OpenAIKeySecretArn "your-secret-arn"
```

Or the original script:
```powershell
.\deploy-sam.ps1 -OpenAIKeySecretArn "your-secret-arn"
```

