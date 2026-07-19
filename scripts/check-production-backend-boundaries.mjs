import fs from "node:fs"

const checks = []

function read(path) {
  return fs.readFileSync(path, "utf8")
}

function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail })
}

const db = read("lib/db.ts")
const repository = read("lib/storage/review-repository-factory.ts")
const repositoryTypes = read("lib/storage/review-repository.ts")
const historyRoute = read("app/api/history/route.ts")
const historyDetailRoute = read("app/api/history/[id]/route.ts")
const middleware = read("middleware.ts")

check(
  "server database client uses service role key",
  db.includes("SUPABASE_SERVICE_ROLE_KEY") && !db.includes("const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  "lib/db.ts must not write user records through the public anon key"
)

check(
  "review record ids support Supabase UUID strings",
  /id:\s*string/.test(db) && /save\(input:\s*SaveReviewRecordData\):\s*Promise<string>/.test(repositoryTypes),
  "review_records.id is uuid in Supabase, so API and repository types must use string ids"
)

check(
  "history detail route does not parse UUID ids as numbers",
  !historyDetailRoute.includes("parseInt(id") && /getReviewRecord\(userId,\s*id\)/.test(historyDetailRoute),
  "app/api/history/[id]/route.ts must pass the route id string through"
)

check(
  "history delete route does not parse UUID ids as numbers",
  !historyRoute.includes("parseInt(searchParams.get(\"id\"") && /deleteReviewRecordById\(userId,\s*id\)/.test(historyRoute),
  "app/api/history/route.ts must delete by string id"
)

check(
  "production storage does not silently fall back to shared SQLite for anonymous users",
  repository.includes("NODE_ENV") && repository.includes("请先登录"),
  "anonymous production reviews must not be saved to one shared local SQLite database"
)

check(
  "middleware matcher is valid",
  !middleware.includes(".*!)") && middleware.includes("api"),
  "middleware matcher must not contain the stray exclamation mark"
)

const failed = checks.filter((item) => !item.ok)

for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`)
  if (!item.ok) console.log(`  ${item.detail}`)
}

if (failed.length > 0) {
  process.exitCode = 1
}
