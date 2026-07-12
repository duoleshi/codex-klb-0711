// scripts/check-ammo-quality.ts
// 检查弹药库条款在 prompt 中的最终引用格式，防止令号/文号与条款号拼接成幻觉引用。
// 运行：npx tsx scripts/check-ammo-quality.ts

import { getAllClauses } from "../lib/clauses/clause-search"
import { formatAnchorClauses } from "../lib/prompts/review-prompts"
import type { MatchedClause } from "../lib/clauses/clause-types"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✅ ${message}`)
  }
}

function asMatched(clause: Awaited<ReturnType<typeof getAllClauses>>[number]): MatchedClause {
  return { ...clause, matchedBy: ["质量检查"] }
}

async function main() {
  const clauses = await getAllClauses()
  const rendered = formatAnchorClauses(clauses.map(asMatched))

  assert(!/第第/.test(rendered), "prompt 锚点引用中不得出现“第第”")
  assert(!/条条/.test(rendered), "prompt 锚点引用中不得出现“条条”")
  assert(!/《国务院令第393号》/.test(rendered), "prompt 不得把国务院令第393号作为规范名称显示")

  const adjacentProtection = clauses.find(
    (c) =>
      c.standard_name === "建设工程安全生产管理条例" &&
      c.standard_code === "国务院令第393号" &&
      c.clause_no === "第三十条" &&
      c.clause_text.includes("毗邻建筑物")
  )

  assert(!!adjacentProtection, "存在建设工程安全生产管理条例第三十条毗邻防护锚点")
  if (adjacentProtection) {
    const adjacentRendered = formatAnchorClauses([asMatched(adjacentProtection)])
    assert(
      adjacentRendered.includes("《建设工程安全生产管理条例》第三十条"),
      "毗邻防护锚点渲染为《建设工程安全生产管理条例》第三十条"
    )
    assert(!adjacentRendered.includes("第第三十条条"), "毗邻防护锚点不得渲染为第第三十条条")
  }

  const suspicious = clauses.filter(
    (c) =>
      /令第.+号/.test(c.standard_name) ||
      /^国务院令第.+号$/.test(c.standard_name) ||
      /^住建部令第.+号$/.test(c.standard_name)
  )
  assert(suspicious.length === 0, `standard_name 不应只填写发布令号，当前 ${suspicious.length} 条`)

  const tooShort = clauses.filter(
    (c) =>
      c.clause_text.trim().length < 10 &&
      c.standard_code !== "建办质〔2024〕63号"
  )
  assert(tooShort.length === 0, `非严重缺陷清单条款原文不应过短，当前 ${tooShort.length} 条`)

  if (process.exitCode) {
    console.error("\n❌ 弹药库质量检查未通过")
    process.exit(process.exitCode)
  }

  console.log("\n✅ 弹药库质量检查通过")
}

main().catch((error) => {
  console.error("检查失败:", error)
  process.exit(1)
})
