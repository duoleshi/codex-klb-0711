// scripts/check-product-refinements.ts
// 验证本轮小优化：材料规格一致性锚点、脚手架三层分层、产品手册。
// 运行：npx tsx scripts/check-product-refinements.ts

import fs from "fs"
import path from "path"
import { getAllClauses } from "../lib/clause-db"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✅ ${message}`)
  }
}

async function main() {
  const clauses = await getAllClauses()
  const materialPlan = clauses.find(
    (c) => c.standard_code === "建办质〔2021〕48号" && c.clause_no === "（三）.2"
  )

  assert(!!materialPlan, "存在建办质〔2021〕48号第（三）.2条锚点")
  assert(
    !!materialPlan?.audit_points?.includes("材料规格") && materialPlan.audit_points.includes("前后一致"),
    "第（三）.2条审核要点明确材料规格必须前后一致"
  )

  const checklistPath = path.join(process.cwd(), "docs", "脚手架工程审核清单.md")
  const checklist = fs.existsSync(checklistPath) ? fs.readFileSync(checklistPath, "utf-8") : ""
  assert(checklist.includes("第一层：脚手架通用原则"), "脚手架清单包含第一层：脚手架通用原则")
  assert(checklist.includes("第二层：悬挑脚手架专用"), "脚手架清单包含第二层：悬挑脚手架专用")
  assert(checklist.includes("第三层：卸料平台专用"), "脚手架清单包含第三层：卸料平台专用")
  assert(checklist.includes("JGJ 80-2016 第6.4.5条") && checklist.includes("卸料平台专用"), "JGJ 80-2016 6.4.5 标注为卸料平台专用")

  const manualPath = path.join(process.cwd(), "docs", "危大工程方案智能审核系统产品手册.md")
  const manual = fs.existsSync(manualPath) ? fs.readFileSync(manualPath, "utf-8") : ""
  assert(manual.includes("# 危大工程方案智能审核系统产品手册"), "产品手册已生成")
  for (const profession of ["模板支撑工程", "起重吊装工程", "深基坑工程", "脚手架工程"]) {
    assert(manual.includes(profession), `产品手册覆盖${profession}`)
  }

  if (process.exitCode) {
    console.error("\n❌ 产品化小优化验证未通过")
    process.exit(process.exitCode)
  }

  console.log("\n✅ 产品化小优化验证通过")
}

main().catch((e) => {
  console.error("验证失败:", e)
  process.exit(1)
})
