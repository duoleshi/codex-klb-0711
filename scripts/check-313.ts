// scripts/check-313.ts
// 验证 JGJ 120 §3.1.3 安全等级条款在基坑方案（无"安全等级"词）下命中
// 治 trigger 悖论：审"缺X"的条款，trigger 改宽加方案必现词，否则方案缺X时trigger不命中
import { getClausesByFeatures, type SchemeFeatures } from "../lib/clause-db"

async function main() {
  // 模拟放坡基坑方案 features：含必现词（开挖深度/边坡/稳定性/土方开挖），不含"安全等级"
  const f: SchemeFeatures = {
    profession: "foundation", structureType: "放坡开挖",
    materials: ["开挖深度", "边坡", "稳定性", "土方开挖", "监测点"],
    processes: ["开挖", "设计计算", "监测"], hazardLevel: "超规模", possibleStandards: ["JGJ 120-2012"],
  }
  const m = await getClausesByFeatures(f)
  const hit = m.find((c) => c.standard_code === "JGJ 120-2012" && c.clause_no === "3.1.3")
  console.log(hit ? "✅ 3.1.3 命中（trigger 改宽生效，方案无'安全等级'词也能审）" : "❌ 3.1.3 未命中")
  if (hit) console.log(`   matchedBy: ${hit.matchedBy.join(", ")}`)
  process.exit(hit ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
