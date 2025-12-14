# Scripts

## `provision-runtime-aws.ps1`

Provisions/updates the **Glazyr Runtime (AWS)** resources used by the extension:

- DynamoDB tasks/actions tables
- SQS steps queue
- IAM role + inline policy
- Lambda ingest (Function URL)
- Lambda worker (SQS-triggered)

### Requirements

- **AWS CLI** (`aws`) installed and authenticated (`aws sts get-caller-identity` succeeds)
- **Node.js + npm** available (script runs `npm install --omit=dev` when packaging Lambdas)
- PowerShell 7+ recommended (Windows PowerShell usually works too)

### Usage

From repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/provision-runtime-aws.ps1 -Region us-east-1 -Prefix glazyr-runtime
```

Parameters:

- `-Region`: AWS region (default `us-east-1`)
- `-Prefix`: resource name prefix (default `glazyr-runtime`)
- `-RuntimeApiKey`: optional API key enforced by the ingest Lambda (empty = no auth)
- `-GoogleVisionServiceAccountJsonFile`: optional path to a GCP service account JSON key file. If provided, the script sets `GOOGLE_VISION_SERVICE_ACCOUNT_JSON` on the ingest Lambda.
- `-GoogleVisionServiceAccountJson`: optional raw JSON string (alternative to `*JsonFile`).

### Output

The script prints the ingest **Function URL base** and the runtime endpoints:

- `POST /runtime/task/start`
- `POST /runtime/vision/ocr`
- `GET  /runtime/next-action?deviceId=<device>`
- `POST /runtime/action-result`
