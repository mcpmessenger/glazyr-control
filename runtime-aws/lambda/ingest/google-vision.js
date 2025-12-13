// Google Vision integration for Lambda (CommonJS).
// Credentials are loaded from either:
// - GOOGLE_VISION_SERVICE_ACCOUNT_JSON (recommended): full service-account JSON as a string
// - GOOGLE_APPLICATION_CREDENTIALS: standard Google SDK file path (optional, if provided in Lambda FS)

const vision = require("@google-cloud/vision")

/** @type {import("@google-cloud/vision").v1.ImageAnnotatorClient | null} */
let cachedClient = null

function loadServiceAccountFromEnv() {
  const raw = process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error("GOOGLE_VISION_SERVICE_ACCOUNT_JSON is not valid JSON")
  }
  if (parsed && typeof parsed.private_key === "string") {
    // Common issue when pasting into env vars: newlines are escaped.
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n")
  }
  return parsed
}

function getVisionClient() {
  if (cachedClient) return cachedClient

  const sa = loadServiceAccountFromEnv()
  if (sa) {
    cachedClient = new vision.ImageAnnotatorClient({
      credentials: {
        client_email: sa.client_email,
        private_key: sa.private_key,
      },
      projectId: sa.project_id,
    })
    return cachedClient
  }

  // Fall back to default Google auth mechanisms (ADC).
  // This will work if GOOGLE_APPLICATION_CREDENTIALS is set or running on GCP with attached SA.
  cachedClient = new vision.ImageAnnotatorClient()
  return cachedClient
}

function stripDataUrlPrefix(maybeDataUrl) {
  const s = String(maybeDataUrl || "")
  const m = s.match(/^data:([^;]+);base64,(.*)$/)
  return m ? m[2] : s
}

function base64ToBuffer(b64) {
  const cleaned = stripDataUrlPrefix(b64).trim()
  if (!cleaned) throw new Error("Missing image data")
  // Basic sanity: avoid accidental huge payloads (Function URL default payload limit still applies).
  if (cleaned.length > 25_000_000) throw new Error("Image payload too large")
  return Buffer.from(cleaned, "base64")
}

/**
 * Perform OCR on an image (PNG/JPEG/etc).
 * @param {string} imageBase64OrDataUrl
 */
async function performOcr(imageBase64OrDataUrl) {
  // If no credentials are configured, Vision client construction may still succeed,
  // but requests will fail. We surface a clearer error message when we can.
  if (!process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Google Vision not configured. Set GOOGLE_VISION_SERVICE_ACCOUNT_JSON (recommended) or GOOGLE_APPLICATION_CREDENTIALS.")
  }

  const client = getVisionClient()
  const imageBuffer = base64ToBuffer(imageBase64OrDataUrl)

  const [result] = await client.documentTextDetection({
    image: { content: imageBuffer },
  })

  const text = result?.fullTextAnnotation?.text || ""
  return { text }
}

module.exports = {
  performOcr,
}


