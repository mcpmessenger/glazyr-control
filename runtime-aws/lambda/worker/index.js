// Lambda (SQS-triggered) worker: advances tasks by enqueuing an action request.
// MVP behavior: for each PLAN step, create a single click action against "#mock-button".

const crypto = require("crypto")
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb")
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } = require("@aws-sdk/lib-dynamodb")

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TASKS_TABLE = process.env.TASKS_TABLE
const ACTIONS_TABLE = process.env.ACTIONS_TABLE

async function getTask(taskId) {
  const res = await dynamo.send(new GetCommand({ TableName: TASKS_TABLE, Key: { taskId } }))
  return res.Item ?? null
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
}

exports.handler = async (event) => {
  const records = event.Records || []
  for (const r of records) {
    let msg
    try {
      msg = JSON.parse(String(r.body || "{}"))
    } catch {
      continue
    }

    const type = String(msg.type || "")
    const taskId = String(msg.taskId || "")
    if (!taskId) continue

    if (type === "PLAN") {
      const task = await getTask(taskId)
      if (!task) continue

      const deviceId = String(task.deviceId || "")
      if (!deviceId) continue

      const stepId = "step-1"
      await updateTask(taskId, { status: "awaiting_action", updatedAt: Date.now() })

      await createPendingActionRequest({
        deviceId,
        taskId,
        stepId,
        action: { type: "click", selector: "#mock-button", description: "MVP: click mock button" },
      })
    }
  }

  return { ok: true }
}

