// scripts/check-pipeline.ts
// Step 3 串联验证：document → Hook1(identifySchemeFeatures) → Hook2(getClausesByFeatures) → 锚点包
// 运行：npx tsx scripts/check-pipeline.ts
//
// 预览实际注入 prompt 的「精准条款锚点」段文本（与 route.ts POST 里的格式化逻辑一致）。
// 注意：本脚本只验证 Hook1→Hook2 这段串联（老路径已废除，extractKnowledgeContext 现仅返锚点）。

import { identifySchemeFeatures } from "../lib/knowledge-base"
import { getClausesByFeatures } from "../lib/clause-db"

const SEP = "═".repeat(70)

// 轮扣式高大模板方案片段
const caseA = `
XX工程高大模板支撑专项施工方案

一、工程概况
本工程为现浇钢筋混凝土楼板，模板支撑体系采用轮扣式钢管脚手架搭设，搭设高度为12m，
属于超过一定规模的危险性较大的分部分项工程（高大模板）。

二、构造要求
立杆采用Φ48×3.0mm钢管，顶部设可调托座传递竖向荷载，丝杆外露长度控制在300mm以内，
可调托撑插入立杆长度不小于150mm。底部设可调底座，调节丝杆外露不大于200mm。
扫地杆纵横向设置，离地高度不大于550mm。剪刀撑采用扣件式钢管，竖向连续设置，间距5-8m。

三、施工工艺
搭设应从一端向另一端推进；拆除时严格遵守从上而下原则，先支后拆、后支先拆。
混凝土浇筑前应组织验收。
`

async function main() {
  console.log(`\n${SEP}\nStep 3 串联验证：document → Hook1 → Hook2 → 锚点包\n${SEP}`)

  const features = await identifySchemeFeatures(caseA)
  const clauses = await getClausesByFeatures(features)

  // 模拟 route.ts POST 里 buildReviewPrompt 调用前的锚点格式化
  const anchorClausesText = clauses.length > 0
    ? clauses
        .map(
          (c) =>
            `【${c.standard_code} 第${c.clause_no}条 ${c.clause_title}】\n` +
            `原文：${c.clause_text}\n` +
            `审核要点：${c.audit_points ?? ""}\n` +
            `（匹配依据：${c.matchedBy.join("、")}）`
        )
        .join("\n\n")
    : ""

  console.log(`\n识别特征: 构造=${features.structureType}, 危大=${features.hazardLevel}, 材料=${features.materials.length}个\n`)
  console.log(`${SEP}\n=== 将注入 prompt 的「精准条款锚点」段 ===\n${SEP}\n`)
  console.log(anchorClausesText || "（无锚点）")
  // 断言：构造专属 = 5 条且全 DB44/T 1876（轮扣式专属，零 JGJ 130 扣件式泄漏）；
  //       强标 general 必带且排首条（Hook2 排序）。
  const constructorClauses = clauses.filter((c) => c.structure_type !== null)
  const generalCount = clauses.filter((c) => c.profession === "general").length
  const constructorStandards = [...new Set(constructorClauses.map((c) => c.standard_code))]
  const noLeak = constructorStandards.length === 1 && constructorStandards[0] === "DB44/T 1876-2016"
  const firstIsGeneral = clauses.length > 0 && clauses[0].profession === "general"
  console.log(`\n${SEP}\n共 ${clauses.length} 条 = 构造专属 ${constructorClauses.length}（${constructorStandards.join("/")}${noLeak ? "" : " ⚠️含其他体系泄漏"}) + 强标 general ${generalCount} + 专业通用 ${clauses.length - constructorClauses.length - generalCount}；首条${firstIsGeneral ? "是" : "非"} general\n${SEP}`)

  const ok = constructorClauses.length === 5 && noLeak && generalCount > 0 && firstIsGeneral
  console.log(`\n${ok ? "✅" : "❌"} Step 3 串联验证 ${ok ? "通过" : "未通过"}（构造=5条 DB44/T 1876 无 JGJ 130 泄漏 / 强标必带 / 排首）\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error("验证失败:", e)
  process.exit(1)
})
