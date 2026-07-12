// scripts/check-clauses.ts
// Step 0 验证脚本：确认 5 条种子条款正确入库并可查
// 运行：npx tsx scripts/check-clauses.ts
//
// 验证通过后可保留（后续 Step 1 会扩展为匹配测试），或删除。

import { getAllClauses } from "../lib/clause-db"
import { formatClauseReference } from "../lib/clauses/clause-reference"

async function main() {
  const clauses = await getAllClauses()

  console.log("\n" + "═".repeat(70))
  console.log(`✅ 条款库查询成功，共 ${clauses.length} 条启用条款`)
  console.log("═".repeat(70) + "\n")

  if (clauses.length === 0) {
    console.error("❌ 未读到任何条款，请检查 data/clause.db 是否生成")
    process.exit(1)
  }

  for (const c of clauses) {
    console.log(`【${c.id}】${formatClauseReference(c)} — ${c.clause_title}`)
    console.log(`     专业: ${c.profession} | 构造: ${c.structure_type ?? "—"} | 危大: ${c.hazard_level ?? "不限"} | 优先级: ${c.priority}`)
    console.log(`     触发材料: ${c.trigger_materials ?? "—"}`)
    console.log(`     触发工艺: ${c.trigger_processes ?? "—"}`)
    console.log(`     原文: ${c.clause_text}`)
    console.log(`     审核要点: ${c.audit_points}`)
    console.log("-".repeat(70))
  }

  // 断言：总数 + 按专业计数（13 专业合计 265）
  const byProfession = clauses.reduce<Record<string, number>>((acc, c) => {
    acc[c.profession] = (acc[c.profession] ?? 0) + 1
    return acc
  }, {})
  const expected: Record<string, number> = {
    template: 43, scaffolding: 33, foundation: 23, crane: 27, demolition: 20, underground: 20,
    "curtain-wall": 17, pile: 12, "steel-structure": 22, underwater: 8,
    "prefabricated-concrete": 18, "new-technology": 8, "limited-space": 14,
    general: 85,
  }
  const okTotal = clauses.length === 350
  const okProfessions = Object.keys(expected).every((p) => byProfession[p] === expected[p])
  const ok = okTotal && okProfessions
  const detail = Object.keys(expected)
    .map((p) => `${p} ${byProfession[p] ?? 0}/${expected[p]}`)
    .join(" | ")
  console.log(`\n${ok ? "✅" : "❌"} 共 ${clauses.length} 条（预期 350）| ${detail}\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error("验证失败:", e)
  process.exit(1)
})
