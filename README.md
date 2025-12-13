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
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/provision-runtime-aws.ps1 -Region us-east-1 -Prefix glazyr-runtime -RuntimeApiKey ""
```

- Requires: `aws` CLI logged in and `npm`.
- Output prints the **Function URL base** and the three endpoints.

## Extension ↔ runtime configuration

The extension can be pointed at a different runtime by setting `chrome.storage.local` keys:

- `glazyrRuntimeBaseUrl`: Function URL base (no trailing slash)
- `glazyrRuntimeApiKey`: optional API key (sent as `x-glazyr-api-key`)
- `glazyrDeviceId`: generated automatically if missing

By default, the current build uses the provisioned Function URL baked into `glazyr-extension/dist/background.js`.

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
