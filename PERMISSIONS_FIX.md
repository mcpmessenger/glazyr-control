# AWS Permissions Issue - Secrets Manager

You're getting this error because your AWS IAM user doesn't have permission to create secrets.

## Quick Solutions

### Option 1: Ask Admin to Create the Secret (Recommended)

Ask someone with AWS admin permissions to create the secret for you:

```powershell
aws secretsmanager create-secret `
  --name glazyr-control/openai-api-key `
  --secret-string "sk-your-openai-key-here" `
  --region us-east-1
```

Then you can deploy using the ARN they give you.

### Option 2: Request IAM Permissions

Ask your AWS administrator to add this policy to your IAM user (`ai-assistant-pro-user`):

**Policy needed:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:396608803476:secret:glazyr-control/*"
    }
  ]
}
```

### Option 3: Check if Secret Already Exists

Maybe someone already created it? Check:

```powershell
aws secretsmanager describe-secret `
  --secret-id glazyr-control/openai-api-key `
  --region us-east-1
```

If it exists, get its ARN:

```powershell
aws secretsmanager describe-secret `
  --secret-id glazyr-control/openai-api-key `
  --region us-east-1 `
  --query "ARN" `
  --output text
```

Then use that ARN in the deployment script.

### Option 4: Temporary Workaround (Less Secure - Dev Only)

If you're just testing locally, you can temporarily modify the Lambda function to accept the key as an environment variable directly (not recommended for production).

However, **Lambda environment variables are visible in the console**, so this is less secure than Secrets Manager.

## Recommended: Option 1

Have an AWS admin create the secret, then continue with deployment. This is the standard, secure approach.
