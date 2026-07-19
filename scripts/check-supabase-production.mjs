import dns from "node:dns/promises"
import fs from "node:fs"

function loadEnv(path = ".env") {
  const env = {}
  const text = fs.readFileSync(path, "utf8")
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

async function fetchJsonish(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text().catch(() => "")
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      // Non-JSON body is fine; caller can inspect text.
    }
    return { ok: response.ok, status: response.status, text, json }
  } finally {
    clearTimeout(timer)
  }
}

function redact(value) {
  return String(value || "")
    .replace(/[A-Za-z0-9_\-]{24,}/g, "[redacted]")
    .replace(/[a-z0-9]{15,}\.supabase\.co/i, "[project-ref].supabase.co")
    .slice(0, 260)
}

const env = loadEnv()
const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]

const checks = []

function push(name, ok, detail, status) {
  checks.push({ name, ok: Boolean(ok), status, detail })
}

for (const key of requiredEnv) {
  push(`env:${key}`, Boolean(env[key]), env[key] ? "present" : "missing")
}

let origin = ""
try {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "")
  origin = url.origin
  push("supabase url format", url.protocol === "https:" && url.hostname.endsWith(".supabase.co"), `${url.protocol}//${url.hostname.replace(/^[^.]+/, "[project-ref]")}`)
  try {
    await dns.lookup(url.hostname)
    push("supabase dns", true, "resolved")
  } catch (error) {
    push("supabase dns", false, redact(error.message), "DNS_ERROR")
  }
} catch (error) {
  push("supabase url format", false, error.message, "URL_ERROR")
}

const anonHeaders = {
  apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
}

const serviceHeaders = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY || "",
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || ""}`,
}

if (origin) {
  const authSettings = await fetchJsonish(`${origin}/auth/v1/settings`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
  })
  push("auth settings with anon key", authSettings.ok, authSettings.ok ? "reachable" : redact(authSettings.text), authSettings.status)

  const adminUsers = await fetchJsonish(`${origin}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: serviceHeaders,
  })
  push("auth admin with service role", adminUsers.ok, adminUsers.ok ? "reachable" : redact(adminUsers.text), adminUsers.status)

  for (const table of ["profiles", "review_records", "usage_records", "subscriptions"]) {
    const tableResult = await fetchJsonish(`${origin}/rest/v1/${table}?select=*&limit=1`, {
      headers: serviceHeaders,
    })
    push(`table:${table}`, tableResult.ok, tableResult.ok ? "queryable" : redact(tableResult.text), tableResult.status)
  }

  const openApi = await fetchJsonish(`${origin}/rest/v1/`, {
    headers: serviceHeaders,
  })
  if (openApi.ok && openApi.json?.definitions) {
    const requiredColumns = {
      profiles: ["id", "phone", "current_plan", "quota_remaining", "created_at", "updated_at"],
      review_records: ["id", "user_id", "report_content", "professional_type", "model", "tokens_used", "file_path", "status", "created_at"],
      usage_records: ["id", "user_id", "review_id", "resource_type", "tokens_used", "cost", "created_at"],
      subscriptions: ["id", "user_id", "plan", "status", "started_at", "expires_at", "created_at"],
    }

    for (const [table, columns] of Object.entries(requiredColumns)) {
      const actual = Object.keys(openApi.json.definitions?.[table]?.properties || {})
      const missing = columns.filter((column) => !actual.includes(column))
      push(`columns:${table}`, missing.length === 0, missing.length === 0 ? "all required columns present" : `missing=${missing.join(",")}`)
    }
  } else {
    push("schema metadata", false, openApi.ok ? "OpenAPI definitions unavailable" : redact(openApi.text), openApi.status)
  }

  const anonReviewRecords = await fetchJsonish(`${origin}/rest/v1/review_records?select=id&limit=1`, {
    headers: anonHeaders,
  })
  const anonBlockedOrEmpty =
    [401, 403].includes(anonReviewRecords.status) ||
    (anonReviewRecords.ok && Array.isArray(anonReviewRecords.json) && anonReviewRecords.json.length === 0)
  push(
    "rls:anon review_records",
    anonBlockedOrEmpty,
    anonBlockedOrEmpty ? "blocked or empty" : redact(anonReviewRecords.text),
    anonReviewRecords.status
  )

  const bucketResult = await fetchJsonish(`${origin}/storage/v1/bucket`, {
    headers: serviceHeaders,
  })
  if (bucketResult.ok && Array.isArray(bucketResult.json)) {
    const buckets = bucketResult.json.map((bucket) => ({
      name: bucket.name,
      public: Boolean(bucket.public),
    }))
    const names = new Set(buckets.map((bucket) => bucket.name))
    push(
      "storage buckets",
      names.has("review-files") && names.has("report-exports"),
      buckets.map((bucket) => `${bucket.name}:public=${bucket.public}`).join(", "),
      bucketResult.status
    )
  } else {
    push("storage buckets", false, redact(bucketResult.text), bucketResult.status)
  }
}

for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}${item.status ? ` (${item.status})` : ""}: ${item.detail}`)
}

if (checks.some((item) => !item.ok)) {
  process.exitCode = 1
}
