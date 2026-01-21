# Install SAM CLI via MSI Installer

Since you don't have global Python/pip, use the MSI installer.

---

## Quick Steps

### 1. Download the MSI

Go to: **https://github.com/aws/aws-sam-cli/releases/latest**

Look for the latest release and download:
- `AWSSAMCLI.msi` (or similar Windows installer)

### 2. Run the Installer

1. Double-click the downloaded `.msi` file
2. Follow the installation wizard
3. Accept defaults (installs to `C:\Program Files\Amazon\SAM CLI\`)

### 3. Restart Terminal

**IMPORTANT:** Close and reopen your PowerShell/terminal after installation.

### 4. Verify Installation

```powershell
sam --version
```

You should see something like:
```
SAM CLI, version 1.x.x
```

---

## After Installation

Once SAM CLI is installed, you can deploy:

```powershell
cd glazyr-control

# Make sure you're NOT in venv (or deactivate it)
deactivate  # if you're in venv

# Deploy
.\deploy-aws-cli.ps1 -OpenAIKeySecretArn "your-secret-arn"
```

---

## Troubleshooting

### "sam: command not found" after installation

1. **Restart your terminal** - PATH changes require a new terminal session
2. If still not found, manually add to PATH:
   - Add `C:\Program Files\Amazon\SAM CLI\bin` to your system PATH
   - Or restart your computer

### Installation fails

- Make sure you have administrator rights
- Check Windows Event Viewer for installation errors
- Try downloading a different version from the releases page

---

## Direct Download Link

**Latest Release (v1.150.1):** https://github.com/aws/aws-sam-cli/releases/tag/v1.150.1

**Download:** `AWS_SAM_CLI_64_PY3.msi` (Windows 64-bit installer)

**All Releases:** https://github.com/aws/aws-sam-cli/releases/latest

The Windows installer is named: `AWS_SAM_CLI_64_PY3.msi`

