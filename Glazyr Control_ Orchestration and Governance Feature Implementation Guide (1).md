# Glazyr Control: Orchestration and Governance Feature Implementation Guide

This document outlines the implementation steps for the new orchestration and governance features in the `glazyr-control` monorepo, incorporating the recent migration from Kafka to **Apache Pulsar** for the core messaging layer.

## 1. Project Structure and Service Setup

The directives introduce new service layers that are not present in the current monorepo structure (which primarily consists of `glazyr-main`, `glazyr-extension`, and `runtime-aws`). The following new top-level directories and services must be created:

| Directory | Purpose | Core Technologies |
| :--- | :--- | :--- |
| `backend/` | Houses the new core orchestration, governance, and commerce services. This will be a new dedicated backend service (e.g., Node.js/TypeScript). | TypeScript, **Pulsar Client**, WebSocket, DynamoDB (for AgentWallet) |
| `supabase/` | Contains serverless functions, specifically for the Vision-First Pipeline. | TypeScript, AWS Textract SDK, OpenAI API (GPT-4o-Vision) |

**Action Item:** Create the necessary directory structure:
```bash
mkdir -p backend/src/orchestrator
mkdir -p backend/src/services/governance
mkdir -p backend/src/services/nexus
mkdir -p supabase/functions/vision-worker
```

## 2. Core Feature Implementation Directives

### 2.1. Swarm Controller (Orchestration Layer)

This component is responsible for decomposing high-level goals and dispatching tasks to the agent swarm via **Apache Pulsar**.

| Detail | Value |
| :--- | :--- |
| **File** | `backend/src/orchestrator/SwarmController.ts` |
| **Dependencies** | `pulsar-client` (Node.js) |
| **Topic (Commands)** | `persistent://public/default/orchestrator-requests` |
| **Topic (Telemetry)** | `persistent://public/default/agent-telemetry` |

**Core Logic (`SwarmController.ts`):**
1.  Initialize a `Pulsar` client instance using the `PULSAR_SERVICE_URL`.
2.  Implement `spawnSwarm(goal: string, swarmSize: number)`.
3.  Inside `spawnSwarm`, call an LLM-based planner (`this.planner.decompose(goal)`) to break the goal into `subtasks`.
4.  Dispatch each subtask to the `orchestrator-requests` Pulsar topic using a configured producer.

### 2.2. Vision-First Pipeline (Cloud-Side Worker)

This worker offloads heavy vision processing from local agents to a cloud environment, optimizing bandwidth by processing S3 references instead of raw bytes.

| Detail | Value |
| :--- | :--- |
| **File** | `supabase/functions/vision-worker/index.ts` |
| **Ingest** | S3 Key of the screenshot/tensor dump (`s3_screenshot_key` or `tensor_ref`). |
| **OCR Process** | Call **AWS Textract** (`AnalyzeDocument`) for layout and text extraction. |
| **Semantic Process** | Call **GPT-4o-Vision** only for a specific "Region of Interest" (ROI) to conserve tokens. |
| **Return** | A specialized JSON **AccessibilityMap** merging OCR text with coordinate data. |

**Action Item:** Ensure the worker's API endpoint is updated to accept a reference key instead of raw image data.

### 2.3. Governance "Kill Switch"

This component provides real-time supervision and enforcement of safety policies.

| Detail | Value |
| :--- | :--- |
| **File** | `backend/src/services/governance/HeartbeatMonitor.ts` |
| **Protocol** | WebSocket connection to `/v2/governance/ws`. |
| **Heartbeat Payload** | `{ agentId: string, currentUrl: string, resourceUsage: number }` |
| **Policy Check** | If `currentUrl` matches a URL in the `GOVERNANCE_BLACKLIST_URLS` environment variable, a violation is triggered. |

**Core Logic:**
1.  Establish a WebSocket server at the specified endpoint.
2.  Monitor incoming heartbeats from `glazyr-chrome-extension` or `neural-chromium` instances.
3.  On policy violation (blacklist match):
    *   Immediately send a `TERMINATE` command back to the agent via the WebSocket.
    *   Revoke the Agent's temporary AWS credentials (e.g., by invalidating the session token).

### 2.4. Project Nexus & UCP Handler

This service handles the "Universal Commerce Protocol" (UCP) for automated payment negotiation.

| Detail | Value |
| :--- | :--- |
| **File** | `backend/src/services/nexus/UCPHandler.ts` |
| **Trigger** | Intercept an HTTP **402 Payment Required** response reported by an agent. |
| **Negotiation** | Parse the `WWW-Authenticate` or custom `UCP-Terms` header from the response. |

**Core Logic:**
1.  Check the agent's balance in the **AgentWallet** (e.g., stored in DynamoDB/Ledger).
2.  Compare the requested price with the agent's `max_budget`.
3.  If `price < max_budget`, sign the payment challenge.
4.  Return the `Payment-Token` header to the agent, allowing it to retry the original request.

## 3. Deployment & Environment Configuration

The following environment variables are required for the new services and should be configured in a `.env.production` file for deployment.

| Category | Variable | Example Value | Description |
| :--- | :--- | :--- | :--- |
| **Swarm Config (Pulsar)** | `PULSAR_SERVICE_URL` | `pulsar://pulsar-broker.example.com:6650` | The service URL for the Apache Pulsar cluster. |
| | `SWARM_TOPIC_REQUESTS` | `persistent://public/default/orchestrator-requests` | Full Pulsar topic name for agent commands. |
| | `SWARM_TOPIC_RESULTS` | `persistent://public/default/agent-telemetry` | Full Pulsar topic name for agent results/telemetry. |
| **Vision Pipeline** | `AWS_TEXTRACT_REGION` | `us-east-1` | AWS region for Textract service calls. |
| | `GOOGLE_VISION_API_KEY` | `AIzaSy...` | API key for Google Vision (if used as a fallback or for specific tasks). |
| **Governance** | `GOVERNANCE_BLACKLIST_URLS` | `["*.mil", "*.gov", "accounts.google.com"]` | JSON array of URL patterns to block. |
| | `KILL_SWITCH_ENABLED` | `true` | Boolean flag to enable/disable the real-time governance monitor. |

**Action Item:** Create the `.env.production` file in the root of the `backend` service directory.

```bash
# Example content for backend/.env.production
PULSAR_SERVICE_URL=pulsar://pulsar-broker.example.com:6650
SWARM_TOPIC_REQUESTS=persistent://public/default/orchestrator-requests
SWARM_TOPIC_RESULTS=persistent://public/default/agent-telemetry

AWS_TEXTRACT_REGION=us-east-1
GOOGLE_VISION_API_KEY=AIzaSy...

GOVERNANCE_BLACKLIST_URLS=["*.mil", "*.gov", "accounts.google.com"]
KILL_SWITCH_ENABLED=true
```
