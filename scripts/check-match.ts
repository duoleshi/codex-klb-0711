// scripts/check-match.ts
// 构造隔离验证：轮扣/盘扣/扣件/碗扣 各只捞自己的条款，不互窜
// 运行：npx tsx scripts/check-match.ts

import { getClausesByFeatures, type SchemeFeatures } from "../lib/clause-db"

const SEP = "═".repeat(70)

async function runCase(
  name: string,
  features: SchemeFeatures,
  expectCount: number,
  expectStandard?: string
): Promise<boolean> {
  const m = await getClausesByFeatures(features)
  // 区分：构造专属条款（structure_type 非空）vs 通用条款（structure_type=null，各构造共享）
  const constructorClauses = m.filter((c) => c.structure_type !== null)
  const genericClauses = m.filter((c) => c.structure_type === null)
  const constructorStandards = [...new Set(constructorClauses.map((c) => c.standard_code))]
  console.log(`\n${SEP}\n${name}\n${SEP}`)
  console.log(`命中 ${m.length} 条 = 构造专属 ${constructorClauses.length} + 通用 ${genericClauses.length}`)
  for (const c of m) {
    const tag = c.structure_type ? `[${c.structure_type}]` : "[通用]"
    console.log(`  • ${c.standard_code} 第${c.clause_no}条 《${c.clause_title}》 ${tag}`)
  }
  // 断言：构造专属条数 = expectCount，且都属 expectStandard（通用条额外，不违反隔离）
  let ok = constructorClauses.length === expectCount
  if (expectStandard && constructorClauses.length > 0) {
    ok = ok && constructorStandards.length === 1 && constructorStandards[0] === expectStandard
  }
  console.log(`${ok ? "✅" : "❌"} ${ok ? "通过" : "未通过"}`)
  return ok
}

async function main() {
  const wheelCoupler: SchemeFeatures = {
    profession: "template", structureType: "轮扣式",
    materials: ["钢管", "可调托座", "剪刀撑", "扫地杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["DB44/T 1876-2016"],
  }
  const discCoupler: SchemeFeatures = {
    profession: "template", structureType: "盘扣式",
    materials: ["钢管", "可调托撑", "可调底座", "扫地杆", "水平杆", "剪刀撑", "斜杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ/T 231-2021"],
  }
  const coupler: SchemeFeatures = {
    profession: "template", structureType: "扣件式",
    materials: ["钢管", "可调托座", "剪刀撑", "扫地杆", "扣件"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ 130-2011"],
  }
  const cuplock: SchemeFeatures = {
    profession: "template", structureType: "碗扣式",
    materials: ["钢管", "可调托撑", "立杆", "水平杆", "斜撑杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ 166-2016"],
  }
  const cuplok: SchemeFeatures = {
    profession: "template", structureType: "套扣式",
    materials: ["可调托座", "可调底座", "剪刀撑", "扫地杆", "水平杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["DBJ/T 15-98-2019"],
  }
  const doorFrame: SchemeFeatures = {
    profession: "template", structureType: "门式",
    materials: ["门架", "跨距", "列距", "剪刀撑", "加固杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ/T 128-2019"],
  }
  const unknown: SchemeFeatures = {
    profession: "template", structureType: "框式",
    materials: [], processes: [], hazardLevel: null, possibleStandards: [],
  }

  const ok1 = await runCase("Case 1 轮扣式 → 5 条 DB44/T 1876", wheelCoupler, 5, "DB44/T 1876-2016")
  const ok2 = await runCase("Case 2 盘扣式 → 8 条 JGJ/T 231", discCoupler, 8, "JGJ/T 231-2021")
  const ok3 = await runCase("Case 3 扣件式 → 5 条 JGJ 130", coupler, 5, "JGJ 130-2011")
  const ok4 = await runCase("Case 4 碗扣式 → 5 条 JGJ 166", cuplock, 5, "JGJ 166-2016")
  const ok5 = await runCase("Case 5 套扣式 → 4 条 DBJ/T 15-98", cuplok, 4, "DBJ/T 15-98-2019")
  const ok6 = await runCase("Case 6 门式 → 3 条 JGJ/T 128", doorFrame, 3, "JGJ/T 128-2019")
  const ok7 = await runCase("Case 7 框式（库中无）→ 0 条", unknown, 0)

  const ok = ok1 && ok2 && ok3 && ok4 && ok5 && ok6 && ok7
  console.log(`\n${SEP}\n${ok ? "✅" : "❌"} 构造隔离验证 ${ok ? "全部通过" : "未通过"}\n${SEP}\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error("验证失败:", e)
  process.exit(1)
})
