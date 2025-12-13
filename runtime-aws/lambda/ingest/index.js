// Lambda (Function URL) handler for:
// - POST /runtime/task/start
// - GET  /runtime/next-action?deviceId=...
// - POST /runtime/action-result
//
// Auth: expects `x-glazyr-api-key: <key>` if GLAZYR_RUNTIME_API_KEY is set.
//
// Data model (DynamoDB):
// - TASKS_TABLE: PK taskId
// - ACTIONS_TABLE: PK deviceId, SK sortKey
//   - pending requests:  sortKey = "pending#<ts>#<requestId>"
//   - inflight requests: sortKey = "inflight#<ts>#<requestId>"
//   - done requests:     sortKey = "done#<ts>#<requestId>"
//
// Queue (SQS):
// - STEPS_QUEUE_URL: messages to advance tasks

const crypto = require("crypto")
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs")
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb")
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, GetCommand, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb")
const { performOcr } = require("./google-vision")

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const sqs = new SQSClient({})

const TASKS_TABLE = process.env.TASKS_TABLE
const ACTIONS_TABLE = process.env.ACTIONS_TABLE
const STEPS_QUEUE_URL = process.env.STEPS_QUEUE_URL
const API_KEY = process.env.GLAZYR_RUNTIME_API_KEY || ""

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-glazyr-api-key,authorization",
    },
    body: JSON.stringify(body ?? null),
  }
}

function noContent() {
  return {
    statusCode: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-glazyr-api-key,authorization",
    },
    body: "",
  }
}

function unauthorized() {
  return json(401, { error: "Unauthorized" })
}

function getHeader(event, name) {
  const headers = event.headers || {}
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : undefined
}

function requireApiKey(event) {
  if (!API_KEY) return null
  const provided =
    getHeader(event, "x-glazyr-api-key") ||
    String(getHeader(event, "authorization") || "").replace(/^Bearer\s+/i, "")
  if (!provided || provided !== API_KEY) return unauthorized()
  return null
}

function parseJsonBody(event) {
  if (!event.body) return null
  try {
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body
  } catch {
    return "__invalid_json__"
  }
}

function getPath(event) {
  // Function URL v2.0 usually provides rawPath.
  return String(event.rawPath || event.path || event.requestContext?.http?.path || "")
}

function getMethod(event) {
  return String(event.requestContext?.http?.method || event.httpMethod || "GET").toUpperCase()
}

function getQuery(event) {
  return event.queryStringParameters || {}
}

async function putTask(task) {
  await dynamo.send(
    new PutCommand({
      TableName: TASKS_TABLE,
      Item: task,
      ConditionExpression: "attribute_not_exists(taskId)",
    }),
  )
}

async function updateTask(taskId, patch) {
  const keys = Object.keys(patch || {})
  if (!keys.length) return
  const expr = []
  const names = {}
  const values = {}
  for (const k of keys) {
    names["#" + k] = k
    values[":" + k] = patch[k]
    expr.push(`#${k} = :${k}`)
  }
  await dynamo.send(
    new UpdateCommand({
      TableName: TASKS_TABLE,
      Key: { taskId },
      UpdateExpression: "SET " + expr.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  )
}

async function enqueueStep(step) {
  if (!STEPS_QUEUE_URL) throw new Error("Missing STEPS_QUEUE_URL env var")
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: STEPS_QUEUE_URL,
      MessageBody: JSON.stringify(step),
    }),
  )
}

async function createPendingActionRequest({ deviceId, taskId, stepId, action }) {
  const requestId = crypto.randomUUID()
  const ts = Date.now()
  const sortKey = `pending#${ts}#${requestId}`
  await dynamo.send(
    new PutCommand({
      TableName: ACTIONS_TABLE,
      Item: {
        deviceId,
        sortKey,
        requestId,
        taskId,
        stepId,
        status: "pending",
        createdAt: ts,
        action,
      },
    }),
  )

  return { requestId, ts }
}

async function claimNextPendingAction(deviceId) {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: ACTIONS_TABLE,
      KeyConditionExpression: "deviceId = :d AND begins_with(sortKey, :p)",
      ExpressionAttributeValues: { ":d": deviceId, ":p": "pending#" },
      Limit: 1,
      ScanIndexForward: true,
    }),
  )

  const item = (res.Items || [])[0]
  if (!item) return null

  const ts = Number(item.createdAt || Date.now())
  const requestId = String(item.requestId)
  const inflightKey = `inflight#${ts}#${requestId}`

  // Transaction: delete pending, put inflight
  await dynamo.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: ACTIONS_TABLE,
            Key: { deviceId, sortKey: item.sortKey },
            ConditionExpression: "attribute_exists(deviceId)",
          },
        },
        {
          Put: {
            TableName: ACTIONS_TABLE,
            Item: {
              ...item,
              sortKey: inflightKey,
              status: "inflight",
              deliveredAt: Date.now(),
            },
          },
        },
      ],
    }),
  )

  return { ...item, sortKey: inflightKey }
}

async function completeInflightAction({ deviceId, requestId, ts, success, error, result }) {
  const inflightKey = `inflight#${ts}#${requestId}`
  const doneKey = `done#${ts}#${requestId}`
  const now = Date.now()

  // Read inflight (strongly consistent read not required for MVP)
  const got = await dynamo.send(
    new GetCommand({
      TableName: ACTIONS_TABLE,
      Key: { deviceId, sortKey: inflightKey },
    }),
  )

  const item = got.Item
  if (!item) return null

  await dynamo.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: ACTIONS_TABLE,
            Key: { deviceId, sortKey: inflightKey },
            ConditionExpression: "attribute_exists(deviceId)",
          },
        },
        {
          Put: {
            TableName: ACTIONS_TABLE,
            Item: {
              ...item,
              sortKey: doneKey,
              status: "done",
              completedAt: now,
              success: !!success,
              error: error ? String(error) : undefined,
              result: result ?? undefined,
            },
          },
        },
      ],
    }),
  )

  return item
}

exports.handler = async (event) => {
  const method = getMethod(event)
  if (method === "OPTIONS") return noContent()

  const auth = requireApiKey(event)
  if (auth) return auth

  const path = getPath(event)

  try {
    // --- POST /runtime/vision/ocr ---
    // Request: { imageDataUrl: "data:image/png;base64,...", languageHints?: string[] }
    // Response: { text: "..." }
    if (method === "POST" && path.endsWith("/runtime/vision/ocr")) {
      const body = parseJsonBody(event)
      if (body === "__invalid_json__") return json(400, { error: "Invalid JSON" })

      const imageDataUrl = String(body?.imageDataUrl || body?.imageBase64 || "").trim()
      if (!imageDataUrl) return json(422, { error: "imageDataUrl is required" })

      try {
        const res = await performOcr(imageDataUrl)
        return json(200, { text: res.text })
      } catch (e) {
        const msg = String(e?.message || e)
        const lower = msg.toLowerCase()
        // Make common bring-up issues obvious.
        if (lower.includes("not configured")) return json(503, { error: msg })
        if (lower.includes("permission_denied") && lower.includes("billing")) {
          return json(503, { error: `Google Vision requires billing enabled for the GCP project. ${msg}` })
        }
        return json(500, { error: msg })
      }
    }

    // --- POST /runtime/task/start ---
    if (method === "POST" && path.endsWith("/runtime/task/start")) {
      const body = parseJsonBody(event)
      if (body === "__invalid_json__") return json(400, { error: "Invalid JSON" })

      const deviceId = String(body?.deviceId || "").trim()
      const intent = String(body?.intent || "").trim()
      const url = String(body?.url || "").trim()
      const title = String(body?.title || "").trim()

      if (!deviceId) return json(422, { error: "deviceId is required" })
      if (!intent) return json(422, { error: "intent is required" })

      const taskId = crypto.randomUUID()
      const now = Date.now()

      await putTask({
        taskId,
        deviceId,
        intent,
        url,
        title,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      })

      // Kick the worker to plan the first step.
      await enqueueStep({ type: "PLAN", taskId })

      return json(201, { taskId, status: "queued" })
    }

    // --- GET /runtime/next-action?deviceId=... ---
    if (method === "GET" && path.endsWith("/runtime/next-action")) {
      const q = getQuery(event)
      const deviceId = String(q.deviceId || "").trim()
      if (!deviceId) return json(422, { error: "deviceId is required" })

      const next = await claimNextPendingAction(deviceId)
      if (!next) return noContent()

      return json(200, {
        deviceId,
        taskId: next.taskId,
        stepId: next.stepId,
        requestId: next.requestId,
        ts: next.createdAt,
        action: next.action,
      })
    }

    // --- POST /runtime/action-result ---
    if (method === "POST" && path.endsWith("/runtime/action-result")) {
      const body = parseJsonBody(event)
      if (body === "__invalid_json__") return json(400, { error: "Invalid JSON" })

      const deviceId = String(body?.deviceId || "").trim()
      const taskId = String(body?.taskId || "").trim()
      const requestId = String(body?.requestId || "").trim()
      const ts = Number(body?.ts)
      const stepId = String(body?.stepId || "").trim()

      if (!deviceId || !taskId || !requestId || !ts || !stepId) {
        return json(422, { error: "deviceId, taskId, requestId, ts, stepId are required" })
      }

      const success = !!body?.success
      const error = body?.error
      const result = body?.result

      const inflight = await completeInflightAction({ deviceId, requestId, ts, success, error, result })
      if (!inflight) return json(409, { error: "No inflight action found (already handled or invalid ids)" })

      // Update task status; for MVP, mark completed after first action.
      const now = Date.now()
      await updateTask(taskId, {
        status: success ? "completed" : "failed",
        updatedAt: now,
        summary: success ? "Completed 1 action (MVP)." : `Failed: ${String(error || "unknown error")}`,
      })

      return json(200, { ok: true })
    }

    return json(404, { error: "Not found" })
  } catch (e) {
    return json(500, { error: String(e?.message || e) })
  }
}

