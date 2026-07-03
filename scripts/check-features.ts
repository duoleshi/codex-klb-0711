// scripts/check-features.ts
// Step 2 验证：identifySchemeFeatures 纯规则识别
// 运行：npx tsx scripts/check-features.ts
//
// 两个用例：
//   Case A：轮扣式高大模板方案片段 → 应识别 structureType=轮扣式, hazardLevel=超规模
//   Case B：盘扣式一般方案片段     → 应识别 structureType=盘扣式

import { identifySchemeFeatures } from "../lib/knowledge-base"

const SEP = "═".repeat(70)

// Case A：轮扣式高大模板方案片段（含轮扣式/高大模板/可调托座/剪刀撑/搭设/拆除）
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

// Case B：盘扣式一般方案片段（含盘扣式，无高大模板/危大关键词）
const caseB = `
XX工程模板支撑方案

模板支撑采用承插型盘扣式钢管脚手架。立杆为A型标准杆，连接盘为八孔圆盘，步距1.5m。
属一般专项方案，按常规施工。
`

async function main() {
  console.log(`\n${SEP}\nCase A: 轮扣式高大模板方案\n${SEP}\n`)
  const fa = await identifySchemeFeatures(caseA)
  console.log(JSON.stringify(fa, null, 2))

  console.log(`\n${SEP}\nCase B: 盘扣式一般方案\n${SEP}\n`)
  const fb = await identifySchemeFeatures(caseB)
  console.log(JSON.stringify(fb, null, 2))

  const okA =
    fa.structureType === "轮扣式" &&
    fa.hazardLevel === "超规模" &&
    fa.materials.includes("可调托座") &&
    fa.materials.includes("剪刀撑") &&
    fa.processes.includes("搭设") &&
    fa.processes.includes("拆除")
  const okB = fb.structureType === "盘扣式"
  const ok = okA && okB

  console.log(`\n${SEP}`)
  console.log(`Case A 断言: ${okA ? "✅" : "❌"} (轮扣式 / 超规模 / 含可调托座+剪刀撑 / 含搭设+拆除)`)
  console.log(`Case B 断言: ${okB ? "✅" : "❌"} (盘扣式)`)
  console.log(`\n${ok ? "✅" : "❌"} Step 2 验证 ${ok ? "通过" : "未通过"}\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error("验证失败:", e)
  process.exit(1)
})
