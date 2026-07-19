import fs from "node:fs"

const checks = []

function read(path) {
  return fs.readFileSync(path, "utf8")
}

function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail })
}

const blogRoute = read("app/api/blog/route.ts")
const storage = read("lib/storage/review-file-storage.ts")
const header = read("components/landing/header.tsx")

check(
  "blog API treats missing blogs table as empty data",
  blogRoute.includes("PGRST205") && blogRoute.includes("data: []") && !blogRoute.includes("Supabase 查询错误"),
  "app/api/blog/route.ts should not return 500 when the optional blogs table is absent"
)

check(
  "storage object key does not include raw filename",
  storage.includes("randomUUID") && !storage.includes("${Date.now()}-${safeFilename}") && storage.includes("originalFilename"),
  "review file storage should use a generated ASCII object key and keep the original filename separately"
)

check(
  "header uses avatar menu instead of rendering full phone",
  header.includes("DropdownMenu") &&
    header.includes("Avatar") &&
    header.includes("maskPhone") &&
    !header.includes("{userPhone}") &&
    !header.includes("setUserPhone(session.user.email.replace"),
  "header should hide the full phone number behind an avatar dropdown"
)

const failed = checks.filter((item) => !item.ok)

for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`)
  if (!item.ok) console.log(`  ${item.detail}`)
}

if (failed.length > 0) {
  process.exitCode = 1
}
