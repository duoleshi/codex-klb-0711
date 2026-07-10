import { getAllClauses } from "../lib/clause-db"
import fs from "fs"
import path from "path"

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function readIfExists(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : ""
}

async function main() {
  const root = process.cwd()
  const clauses = await getAllClauses()

  const demolition = clauses.filter((c) => c.profession === "demolition")
  const underground = clauses.filter((c) => c.profession === "underground")

  assert(demolition.length === 20, `拆除爆破条款数量为 20 条，当前 ${demolition.length} 条`)
  assert(underground.length === 20, `暗挖工程条款数量为 20 条，当前 ${underground.length} 条`)

  const demolitionTypes = new Set(demolition.map((c) => c.structure_type ?? "拆除通用"))
  for (const type of ["人工拆除", "机械拆除", "爆破拆除", "拆除通用"]) {
    assert(demolitionTypes.has(type), `拆除爆破条款包含 ${type}`)
  }

  const undergroundTypes = new Set(underground.map((c) => c.structure_type ?? "暗挖通用"))
  for (const type of ["盾构法", "顶管法", "矿山法", "冻结法", "暗挖通用"]) {
    assert(undergroundTypes.has(type), `暗挖条款包含 ${type}`)
  }

  const demolitionScript = path.join(root, "scripts", "export-demolition-checklist.ts")
  const undergroundScript = path.join(root, "scripts", "export-underground-checklist.ts")
  assert(fs.existsSync(demolitionScript), "存在拆除爆破审核清单导出脚本")
  assert(fs.existsSync(undergroundScript), "存在暗挖工程审核清单导出脚本")

  const demolitionDocPath = path.join(root, "docs", "拆除爆破审核清单.md")
  const undergroundDocPath = path.join(root, "docs", "暗挖工程审核清单.md")
  const demolitionDoc = readIfExists(demolitionDocPath)
  const undergroundDoc = readIfExists(undergroundDocPath)

  assert(demolitionDoc.includes("# 拆除爆破审核清单"), "拆除爆破审核清单标题正确")
  for (const text of ["人工拆除", "机械拆除", "爆破拆除", "拆除通用条款", "高频易错点"]) {
    assert(demolitionDoc.includes(text), `拆除爆破审核清单包含 ${text}`)
  }

  assert(undergroundDoc.includes("# 暗挖工程审核清单"), "暗挖工程审核清单标题正确")
  for (const text of ["盾构法", "顶管法", "矿山法", "冻结法", "暗挖通用条款", "高频易错点"]) {
    assert(undergroundDoc.includes(text), `暗挖工程审核清单包含 ${text}`)
  }

  const manualPath = path.join(root, "docs", "危大工程方案智能审核系统产品手册.md")
  const manual = readIfExists(manualPath)
  assert(manual.includes("拆除、爆破工程"), "产品手册包含拆除、爆破工程")
  assert(manual.includes("暗挖工程"), "产品手册包含暗挖工程")
  assert(
    manual.includes("六专业审核清单") || manual.includes("十三专业审核清单"),
    "产品手册包含当前专业审核清单总表"
  )

  if (process.exitCode) {
    process.exit(process.exitCode)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
