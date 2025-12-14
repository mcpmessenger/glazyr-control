# Glazyr (monorepo)

Glazyr is a **safety-first web automation stack** split into three responsibilities:

- **Control plane (web UI)**: authentication, configuration, safety boundaries, monitoring.
- **Extension (execution surface)**: runs in the browser, captures context, enforces local safety policy, executes approved actions.
- **Runtimes (backends)**:
  - **Vision runtime** (`runtime-aws/`): Google Vision OCR + basic vision analysis (AWS Lambda Function URL).
  - **Orchestration runtime** (`glazyr-control/`): MCP-native “assistant/orchestrator” (FastAPI; local dev + AWS Lambda via SAM).

## Repo layout

- **`glazyr-main/`**: Next.js web control plane.
- **`glazyr-extension/`**: Chrome Extension (Manifest V3). Load from `glazyr-extension/dist/`.
- **`runtime-aws/`**: AWS vision runtime (Lambda ingest + SQS worker + DynamoDB; includes Vision endpoints).
- **`glazyr-control/`**: MCP runtime (FastAPI) + AWS SAM deployment (Lambda Function URL).
- **`scripts/`**: provisioning helpers (AWS CLI + PowerShell).

## POC status (working)

- **Vision (OCR + labels/objects)**: ✅ **Google Vision is wired end-to-end** via `runtime-aws`:
  - Extension calls `POST /runtime/vision/analyze` (Vision-first; includes OCR text only when detected).
  - `POST /runtime/vision/ocr` remains available (legacy/compat).
- **Widget UX**:
  - ✅ Widget default position/size is clamped to the viewport (won’t open cut off).
  - ✅ A draggable in-page **Glazyr logo launcher** toggles the widget.
  - ✅ Screenshot preview is **not** rendered inside the widget (saves space for chat/analysis).
- **MCP runtime (assistant/orchestrator)**: ✅ `glazyr-control` runs locally and exposes:
  - `GET /mcp/manifest`
  - `POST /mcp/invoke`
  - `GET /api/tasks` + `GET /api/tasks/{task_id}` (safe summaries only)

> Note: Google Vision requires **billing enabled** on the GCP project. See `runtime-aws/README.md`.

## Quickstart (local)

### Web control plane

```bash
cd glazyr-main
npm install
npm run dev
```

Open `http://localhost:3000`.

### MCP runtime (glazyr-control)

```powershell
cd glazyr-control
py -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:OPENAI_API_KEY = "..."   # do NOT commit; do NOT put keys in the extension
& .\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8012
```

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
- Vision-first endpoint: `POST /runtime/vision/analyze`
- To enable OCR, pass a service account key file:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/provision-runtime-aws.ps1 -Region us-east-1 -Prefix glazyr-runtime -GoogleVisionServiceAccountJsonFile "C:\path\to\vision-sa.json"
```

## Extension ↔ runtime configuration

The extension can be pointed at different backends by setting `chrome.storage.local` keys:

- **Vision runtime (`runtime-aws`)**
  - `glazyrRuntimeBaseUrl`: Function URL base (no trailing slash)
  - `glazyrRuntimeApiKey`: optional API key (sent as `x-glazyr-api-key`)
- **MCP runtime (`glazyr-control`)**
  - `glazyrMcpRuntimeBaseUrl`: Function URL base (no trailing slash)
  - `glazyrMcpRuntimeApiKey`: optional key (sent as `x-glazyr-api-key` or `Authorization: Bearer ...`)
- **Legacy orchestrator polling** (deprecated; opt-in)
  - `glazyrLegacyOrchestratorEnabled`: set `true` to enable `/runtime/next-action` polling loop
- `glazyrDeviceId`: generated automatically if missing

By default, the current build uses the provisioned Function URL baked into `glazyr-extension/dist/background.js`.

## Security notes (important)

- **Never commit** Google service account keys. If a key is pasted/shared, **revoke/rotate it immediately**.
- **Never ship provider keys client-side** (extensions/web apps). Put provider keys in backend env/secrets and authenticate clients with your own API key/session.
- For AWS, prefer **Secrets Manager** (e.g. `OPENAI_API_KEY_SECRET_ARN` in `glazyr-control`) and keep client auth separate.

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
  - the **vision runtime** (`runtime-aws`) for OCR/labels/objects
  - the **MCP runtime** (`glazyr-control`) for assistant/orchestration via MCP

## Docs

- Control plane details: `glazyr-main/README.md`
- Extension details: `glazyr-extension/README.md`
- MCP runtime details: `glazyr-control/README.md`
- AWS runtime details: `runtime-aws/README.md`
- Scripts: `scripts/README.md`
- Handoff instructions: `HANDOFF_INSTRUCTIONS.md` (team integration guide)
