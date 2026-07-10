// scripts/check-scaffolding-mixed.ts
// 验证脚手架混合方案：拉杆式悬挑外架 + 悬挑卸料平台。
// 运行：npx tsx scripts/check-scaffolding-mixed.ts

import { getClausesByFeatures } from "../lib/clause-db"
import { identifySchemeFeatures } from "../lib/knowledge-base"

const sample = `
B1B2拉杆式悬挑外架及卸料平台专项施工方案。
本工程外脚手架采用型钢悬挑脚手架，悬挑钢梁、U形拉环、锚固螺栓按计算设置，
一次悬挑高度20m。作业脚手架连墙件采用预埋短钢管连接，最上层连墙件以上自由高度6m。
另设悬挑式卸料平台，平台搁置点、拉结点与主体结构连接，钢丝绳作为安全储备，不参与平台受力计算。
卸料平台设置限载牌，材料及时转运，不得超重堆放。
`

function hasClause(clauses: { standard_code: string; clause_no: string }[], standard: string, clauseNo: string): boolean {
  return clauses.some((c) => c.standard_code === standard && c.clause_no === clauseNo)
}

async function main() {
  const features = await identifySchemeFeatures(sample)
  const clauses = await getClausesByFeatures(features)

  const required = [
    ["GB 55023-2022", "4.4.6", "连墙件刚性要求"],
    ["GB 55023-2022", "5.2.1", "自由高度与同步搭设"],
    ["GB 55023-2022", "5.3.3", "卸料平台严禁固定在作业脚手架上"],
    ["JGJ 80-2016", "6.4.1", "悬挑式操作平台支承点主体结构"],
    ["JGJ 80-2016", "6.4.3", "斜拉钢丝绳承载该侧全部荷载"],
    ["JGJ 80-2016", "C.0.4", "钢丝绳拉力与安全系数验算"],
  ] as const

  console.log("\n脚手架混合方案识别：")
  console.log(`专业=${features.profession}，构造=${features.structureType ?? "—"}，材料=${features.materials.join(",")}`)
  console.log(`命中条款=${clauses.length}`)

  const missing = required.filter(([standard, clauseNo]) => !hasClause(clauses, standard, clauseNo))

  for (const [standard, clauseNo, title] of required) {
    const ok = hasClause(clauses, standard, clauseNo)
    console.log(`${ok ? "✅" : "❌"} ${standard} 第${clauseNo}条 ${title}`)
  }

  const ok =
    features.profession === "scaffolding" &&
    features.structureType === "悬挑式脚手架" &&
    missing.length === 0

  if (!ok) {
    console.error("\n❌ 脚手架混合方案验证未通过")
    process.exit(1)
  }

  console.log("\n✅ 脚手架混合方案验证通过")
}

main().catch((e) => {
  console.error("验证失败:", e)
  process.exit(1)
})
