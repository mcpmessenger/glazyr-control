# Glazyr Runtime (AWS)

This directory contains a minimal **serverless runtime backend** used by the extension for orchestration.

It implements a simple loop:

1. Extension sends an intent: **`POST /runtime/task/start`**
2. Runtime enqueues a planning step (SQS)
3. Worker creates a pending action request (DynamoDB)
4. Extension polls: **`GET /runtime/next-action?deviceId=...`**
5. Extension executes locally and reports result: **`POST /runtime/action-result`**

## What gets created

Provisioning (via `scripts/provision-runtime-aws.ps1`) creates/updates:

- **DynamoDB**
  - `<prefix>-tasks` (PK: `taskId`)
  - `<prefix>-actions` (PK: `deviceId`, SK: `sortKey`)
- **SQS**
  - `<prefix>-steps`
- **Lambda**
  - `<prefix>-ingest` (Function URL; HTTP API)
  - `<prefix>-worker` (SQS-triggered)
- **IAM**
  - `<prefix>-lambda-role` with least-privilege DDB + SQS access

## Endpoints

All endpoints are served from the **Lambda Function URL base** printed by the provision script.

- **`POST /runtime/vision/ocr`**

Request:

```json
{
  "imageDataUrl": "data:image/png;base64,..."
}
```

Response (`200`):

```json
{ "text": "..." }
```

- **`POST /runtime/task/start`**

Request:

```json
{
  "deviceId": "dev-1",
  "intent": "click the button",
  "url": "https://example.com",
  "title": "Example"
}
```

Response (`201`):

```json
{ "taskId": "...", "status": "queued" }
```

- **`GET /runtime/next-action?deviceId=...`**

Response (`200`):

```json
{
  "deviceId": "dev-1",
  "taskId": "...",
  "stepId": "...",
  "requestId": "...",
  "ts": 1730000000000,
  "action": { "type": "click", "selector": "#mock-button" }
}
```

Response (`204`): no pending actions.

- **`POST /runtime/action-result`**

Request:

```json
{
  "deviceId": "dev-1",
  "taskId": "...",
  "stepId": "...",
  "requestId": "...",
  "ts": 1730000000000,
  "success": true,
  "result": { "action": "click", "selector": "#mock-button" }
}
```

Response (`200`):

```json
{ "ok": true }
```

## Auth

If `GLAZYR_RUNTIME_API_KEY` is set on the ingest Lambda, clients must send:

- Header: `x-glazyr-api-key: <key>`

## Google Vision OCR (server-side)

Set **one** of the following env vars on the **ingest** Lambda:

- `GOOGLE_VISION_SERVICE_ACCOUNT_JSON` (recommended): full service account JSON as a string
- `GOOGLE_APPLICATION_CREDENTIALS`: path to a credentials JSON file (only if you provide one in the Lambda filesystem)

### Billing requirement

Google Vision OCR requires the **Cloud Vision API enabled** and **billing enabled** on the GCP project. If billing is not enabled, `/runtime/vision/ocr` will fail with `PERMISSION_DENIED` mentioning billing.

## Code layout

- **`lambda/ingest/`**: Function URL handler (HTTP endpoints)
- **`lambda/worker/`**: SQS-triggered worker (MVP planner)
- **`dist/`**: zipped deployment artifacts (generated)

## Provision / update

Run from repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/provision-runtime-aws.ps1 -Region us-east-1 -Prefix glazyr-runtime
```

To set Vision credentials during provisioning:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/provision-runtime-aws.ps1 -Region us-east-1 -Prefix glazyr-runtime -GoogleVisionServiceAccountJsonFile "C:\path\to\vision-sa.json"
```

## Cleanup (manual)

There isn’t a teardown script yet; delete in AWS:

- Lambda functions: `<prefix>-ingest`, `<prefix>-worker`
- Event source mapping for the worker
- SQS queue: `<prefix>-steps`
- DynamoDB tables: `<prefix>-tasks`, `<prefix>-actions`
- IAM role: `<prefix>-lambda-role` (and its inline policy)
