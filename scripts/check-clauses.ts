// scripts/check-clauses.ts
// Step 0 验证脚本：确认 5 条种子条款正确入库并可查
// 运行：npx tsx scripts/check-clauses.ts
//
// 验证通过后可保留（后续 Step 1 会扩展为匹配测试），或删除。

import { getAllClauses } from "../lib/clause-db"

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
    console.log(`【${c.id}】${c.standard_code} 第 ${c.clause_no} 条 — ${c.clause_title}`)
    console.log(`     专业: ${c.profession} | 构造: ${c.structure_type ?? "—"} | 危大: ${c.hazard_level ?? "不限"} | 优先级: ${c.priority}`)
    console.log(`     触发材料: ${c.trigger_materials ?? "—"}`)
    console.log(`     触发工艺: ${c.trigger_processes ?? "—"}`)
    console.log(`     原文: ${c.clause_text}`)
    console.log(`     审核要点: ${c.audit_points}`)
    console.log("-".repeat(70))
  }

  // 简单断言：轮扣式 5 条 + 盘扣式 5 条 = 10 条
  const expectedNos = ["7.1.6","7.1.7","7.1.8","9.2.2","7.1.4","6.2.4","6.2.5","6.1.3","6.2.7","6.1.4","3.0.1","6.1.5","附录D","6.9.6","6.9.1","6.9.3","6.3.2","3.1.2","6.3.3","6.3.5","6.3.6","6.3.8","6.3.10","5.1.2","7.0.3","8.0.4","5.1.4","1.3","5.2.1","5.1.6","8.0.5","4.4.12","5.4.2","6.1.10","6.1.11","6.1.6","6.1.8","6.4.1","6.4.3","6.4.5"]
  const gotNos = clauses.map((c) => c.clause_no).sort()
  const ok = clauses.length === 41 && expectedNos.every((n) => gotNos.includes(n))
  console.log(`\n${ok ? "✅" : "❌"} 共 ${clauses.length} 条（预期 41），条款号: ${gotNos.join(", ")}\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error("验证失败:", e)
  process.exit(1)
})
