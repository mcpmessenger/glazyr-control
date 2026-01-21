# AWS CLI vs SAM CLI - What's the Difference?

## AWS CLI ✅ (You have this!)
- **What it does**: General AWS operations
- **Examples**: 
  - `aws s3 ls` - list S3 buckets
  - `aws secretsmanager create-secret` - create secrets
  - `aws lambda list-functions` - list Lambda functions
  - `aws sts get-caller-identity` - check your identity
- **Purpose**: Direct AWS service management

## SAM CLI ❌ (You need this!)
- **What it does**: Build and deploy serverless applications
- **Examples**:
  - `sam build` - builds your Lambda code
  - `sam deploy` - deploys using CloudFormation
  - `sam local invoke` - test locally
- **Purpose**: Serverless application development/deployment
- **Requires**: AWS CLI (uses it under the hood) + Docker

## Why You Need Both

For deploying `glazyr-control`:
1. **AWS CLI** - You used it to create the secret ✅
2. **SAM CLI** - Needed to build and deploy the Lambda function ❌

## How They Work Together

```
You run: sam deploy
    ↓
SAM CLI:
  1. Builds your code (needs Docker)
  2. Packages it
  3. Uses AWS CLI to:
     - Upload to S3
     - Create/update CloudFormation stack
     - Deploy Lambda function
```

## Installation

**AWS CLI** ✅ - You already have this!

**SAM CLI** ❌ - Need to install separately:

**Windows:**
1. Download MSI: https://github.com/aws/aws-sam-cli/releases/latest
2. Install `AWSSAMCLISetup.exe`
3. Restart PowerShell
4. Test: `sam --version`

**OR via pip:**
```powershell
py -m pip install aws-sam-cli
sam --version
```

## Quick Check

```powershell
# Check AWS CLI (you have this)
aws --version

# Check SAM CLI (you need this)
sam --version
```
