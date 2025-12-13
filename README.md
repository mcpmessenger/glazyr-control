# Glazyr (monorepo)

Glazyr is a **safety-first web automation stack** split into three responsibilities:

- **Control plane (web UI)**: authentication, configuration, safety boundaries, monitoring.
- **Extension (execution surface)**: runs in the browser, captures context, enforces local safety policy, executes approved actions.
- **Runtime (orchestrator backend)**: receives intents, produces next actions, records outcomes (MVP: AWS Lambda + SQS + DynamoDB).

## Repo layout

- **`glazyr-main/`**: Next.js web control plane.
- **`glazyr-extension/`**: Chrome Extension (Manifest V3). Load from `glazyr-extension/dist/`.
- **`runtime-aws/`**: AWS runtime (Lambda ingest + SQS worker + DynamoDB) used by the extension.
- **`scripts/`**: provisioning helpers (AWS CLI + PowerShell).

## POC status (working)

- **Vision (OCR)**: ✅ **Google Vision OCR is wired end-to-end** via `runtime-aws`:
  - Extension captures a framed screenshot region and calls `POST /runtime/vision/ocr`.
  - OCR text is printed into the widget chat (not a separate panel).
- **Widget UX**:
  - ✅ Widget default position/size is clamped to the viewport (won’t open cut off).
  - ✅ A draggable in-page **Glazyr logo launcher** toggles the widget.
  - ✅ Screenshot preview is **not** rendered inside the widget (saves space for chat/analysis).

> Note: Google Vision requires **billing enabled** on the GCP project. See `runtime-aws/README.md`.

## Quickstart (local)

### Web control plane

```bash
cd glazyr-main
npm install
npm run dev
```

Open `http://localhost:3000`.

### Chrome extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select: `glazyr-extension/dist/`

## Runtime (AWS) provisioning

Provision / update the runtime backend (creates DynamoDB tables, SQS queue, IAM role/policy, two Lambdas, Function URL, and SQS trigger):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/provision-runtime-aws.ps1 -Region us-east-1 -Prefix glazyr-runtime
```

- Requires: `aws` CLI logged in and `npm`.
- Output prints the **Function URL base** and the endpoints (includes `/runtime/vision/ocr`).
- To enable OCR, pass a service account key file:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/provision-runtime-aws.ps1 -Region us-east-1 -Prefix glazyr-runtime -GoogleVisionServiceAccountJsonFile "C:\path\to\vision-sa.json"
```

## Extension ↔ runtime configuration

The extension can be pointed at a different runtime by setting `chrome.storage.local` keys:

- `glazyrRuntimeBaseUrl`: Function URL base (no trailing slash)
- `glazyrRuntimeApiKey`: optional API key (sent as `x-glazyr-api-key`)
- `glazyrDeviceId`: generated automatically if missing

By default, the current build uses the provisioned Function URL baked into `glazyr-extension/dist/background.js`.

## Security notes (important)

- **Never commit** Google service account keys. If a key is pasted/shared, **revoke/rotate it immediately**.
- If you cannot store service account JSON in Lambda env vars (size limits), use AWS SSM/Secrets Manager and load it at runtime (next step).

## Safety model (high level)

- **Kill switch**: blocks capture + action execution.
- **Agent mode**:
  - `observe`: blocks click/type/navigate/submit
  - `assist` / `automate`: allowed, still gated by domain + disallowed action list
- **Allowed domains + disallowed actions**: configured in the control plane and enforced in the extension.

## Where orchestration lives

- The **control plane does not execute automation**.
- Execution is handled by:
  - the **extension** (local enforcement + action execution)
  - the **runtime backend** (planning / action queueing / state)

## Docs

- Control plane details: `glazyr-main/README.md`
- Extension details: `glazyr-extension/README.md`
- AWS runtime details: `runtime-aws/README.md`
- Scripts: `scripts/README.md`
