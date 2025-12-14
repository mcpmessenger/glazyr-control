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

function buildCaption({ text, labels, objects }) {
  // Keep it short, predictable, and cheap (no LLM). This is mainly a helpful fallback for UI.
  const parts = []
  const topObjects = (objects || [])
    .map((o) => String(o?.name || "").trim())
    .filter(Boolean)
    .slice(0, 5)
  const topLabels = (labels || [])
    .map((l) => String(l?.description || "").trim())
    .filter(Boolean)
    .slice(0, 8)

  if (topObjects.length) parts.push(`Objects: ${topObjects.join(", ")}`)
  if (topLabels.length) parts.push(`Labels: ${topLabels.join(", ")}`)

  const hasText = String(text || "").trim().length > 0
  if (hasText) parts.push("Text detected")

  return parts.join(" · ")
}

/**
 * Combined Vision analysis (OCR + labels + objects) in one call.
 * @param {string} imageBase64OrDataUrl
 * @param {{ features?: { ocr?: boolean, labels?: boolean, objects?: boolean } }} [options]
 */
async function performAnalyze(imageBase64OrDataUrl, options) {
  if (!process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Google Vision not configured. Set GOOGLE_VISION_SERVICE_ACCOUNT_JSON (recommended) or GOOGLE_APPLICATION_CREDENTIALS.")
  }

  const features = options?.features || {}
  const wantOcr = features.ocr !== false
  const wantLabels = features.labels !== false
  const wantObjects = features.objects !== false

  const reqFeatures = []
  if (wantOcr) reqFeatures.push({ type: "DOCUMENT_TEXT_DETECTION" })
  if (wantLabels) reqFeatures.push({ type: "LABEL_DETECTION" })
  if (wantObjects) reqFeatures.push({ type: "OBJECT_LOCALIZATION" })

  // Default to something useful even if caller passes an empty object.
  if (!reqFeatures.length) reqFeatures.push({ type: "DOCUMENT_TEXT_DETECTION" })

  const client = getVisionClient()
  const imageBuffer = base64ToBuffer(imageBase64OrDataUrl)

  const [result] = await client.annotateImage({
    image: { content: imageBuffer },
    features: reqFeatures,
  })

  const text = result?.fullTextAnnotation?.text || ""
  const labelAnnotations = Array.isArray(result?.labelAnnotations) ? result.labelAnnotations : []
  const localizedObjectAnnotations = Array.isArray(result?.localizedObjectAnnotations) ? result.localizedObjectAnnotations : []

  const labels = labelAnnotations.map((l) => ({
    description: l?.description || "",
    score: typeof l?.score === "number" ? l.score : undefined,
  }))

  const objects = localizedObjectAnnotations.map((o) => ({
    name: o?.name || "",
    score: typeof o?.score === "number" ? o.score : undefined,
    boundingPoly: o?.boundingPoly,
  }))

  const caption = buildCaption({ text, labels, objects })

  return {
    text,
    caption,
    labels,
    objects,
    // Include the raw-ish arrays too, because the extension already has formatting fallbacks for these keys.
    labelAnnotations,
    localizedObjectAnnotations,
  }
}

module.exports = {
  performOcr,
  performAnalyze,
}


