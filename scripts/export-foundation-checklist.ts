// scripts/export-foundation-checklist.ts
// 从 clause.db 导出深基坑审核清单（markdown）—— 产品化资产 3
// 运行：npx tsx scripts/export-foundation-checklist.ts
// 产出：docs/深基坑审核清单.md
//
// 老师第三件·动作一：深基坑方向（补 JGJ 120/GB 50497/JGJ 111 核心后）沉淀审核清单。

import { getAllClauses, type Clause } from "../lib/clause-db"
import { formatClauseReference } from "../lib/clauses/clause-reference"
import fs from "fs"
import path from "path"

const GROUPS: { title: string; subtitle: string; filter: (c: Clause) => boolean }[] = [
  { title: "一、基坑核心（选型/稳定性/监测/降水/开挖/报警）", subtitle: "JGJ 120 支护选型+稳定性 + GB 50497 监测项目+报警 + JGJ 111 降水 + GB 55003 强标 + JGJ 180 土石方",
    filter: (c) => c.profession === "foundation" && c.structure_type === null },
  { title: "二、排桩支护", subtitle: "DBJ/T 15-20-2016《建筑基坑工程技术规程》",
    filter: (c) => c.profession === "foundation" && c.structure_type === "排桩支护" },
  { title: "三、地下连续墙", subtitle: "DBJ/T 15-20-2016",
    filter: (c) => c.profession === "foundation" && c.structure_type === "地下连续墙" },
  { title: "四、土钉墙", subtitle: "GB 50739-2011《复合土钉墙基坑支护技术规范》+ DBJ/T 15-20",
    filter: (c) => c.profession === "foundation" && c.structure_type === "土钉墙" },
  { title: "五、锚杆支护", subtitle: "DBJ/T 15-20 + GB 50086-2015《岩土锚杆与喷射混凝土支护工程技术规范》",
    filter: (c) => c.profession === "foundation" && c.structure_type === "锚杆支护" },
  { title: "六、放坡开挖", subtitle: "DBJ/T 15-20-2016",
    filter: (c) => c.profession === "foundation" && c.structure_type === "放坡开挖" },
]

function extractCommonError(ap: string | null): string {
  if (!ap) return ""
  const m1 = ap.match(/方案若[^，。；]*?(即不符|即违反|不符)/)
  if (m1) return m1[0].replace(/(即不符(合)?|不符)[，。；]?$/, "")
  const m2 = ap.match(/方案笼统写['"]?[^，。；]*?[，。；]/)
  if (m2) return m2[0].replace(/[，。；]$/, "")
  const m3 = ap.match(/不得套用[^，。；]*?[，。；]/)
  if (m3) return m3[0].replace(/[，。；]$/, "")
  const m4 = ap.match(/若[^，。；]{2,15}?即[^，。；]*?[，。；]/)
  if (m4) return m4[0].replace(/[，。；]$/, "")
  return ""
}

function firstSentence(ap: string | null): string {
  if (!ap) return ""
  const s = ap.split(/。[。]/)[0].replace(/^核对[：:]?/, "").trim()
  return s.length > 55 ? s.slice(0, 55) + "…" : s
}

async function main() {
  const all = await getAllClauses()
  const foundation = all.filter((c) => c.profession === "foundation")
  console.log(`深基坑条款共 ${foundation.length} 条，开始导出…`)

  const lines: string[] = []
  lines.push("# 深基坑审核清单")
  lines.push("")
  lines.push("> 由 clause-db 锚点库自动导出。每条 = 一个审核检查点，含规范依据、审核要点、常见错误。")
  lines.push(`> 共 ${foundation.length} 条 = 基坑核心（JGJ 120/GB 50497/JGJ 111/GB 55003/JGJ 180）+ 排桩/地连墙/土钉墙/锚杆/放坡。`)
  lines.push(`> 导出时间：${new Date().toLocaleString("zh-CN")}`)
  lines.push("")
  lines.push("**使用说明**：审核员对照方案，按本清单逐条核查。多专业调度（`getClausesByFeatures` 按 profession 过滤）保障——基坑方案下自动激活本库，不混入模板/起重规范。")
  lines.push("")
  lines.push("**核心规范**：")
  lines.push("- **JGJ 120-2012**《建筑基坑支护技术规程》：支护选型(3.3) + 稳定性验算(4.2) —— 基坑「母法」")
  lines.push("- **GB 50497-2019**《建筑基坑工程监测技术标准》：监测项目(4.2) + 报警(8.0)")
  lines.push("- **JGJ 111-2016**《地下水控制技术规范》：降水井设计 + 涌水量/出水量计算")
  lines.push("- GB 55003-2021 地基基础通用规范（强标）/ JGJ 180-2009 土石方")
  lines.push("- 支护构造：DBJ/T 15-20（排桩/地连墙/放坡）+ GB 50739（土钉墙）+ GB 50086（锚杆）")
  lines.push("")

  let idx = 0
  for (const g of GROUPS) {
    const clauses = foundation.filter(g.filter)
    if (clauses.length === 0) continue
    clauses.sort((a, b) => b.priority - a.priority || a.clause_no.localeCompare(b.clause_no))
    lines.push(`## ${g.title}`)
    lines.push(`**${g.subtitle}** — ${clauses.length} 条`)
    lines.push("")
    lines.push("| # | 审核项 | 规范条款 | 审核要点（精简） | 常见错误 |")
    lines.push("|---|--------|----------|------------------|----------|")
    for (const c of clauses) {
      idx++
      const item = c.clause_title.replace(/\|/g, "/")
      const ref = formatClauseReference(c)
      const point = firstSentence(c.audit_points)
      const err = extractCommonError(c.audit_points) || "—"
      lines.push(`| ${idx} | ${item} | ${ref} | ${point} | ${err} |`)
    }
    lines.push("")
  }

  // 高频易错点附录（基于污水池基坑真实审核 + JGJ 120/GB 50497 核心）
  lines.push("## 附录：高频易错点（来自深基坑真实审核案例）")
  lines.push("")
  lines.push("| 类型 | 易错点 | 规范值 | 错误写法 | 后果 |")
  lines.push("|------|--------|--------|----------|------|")
  lines.push("| 支护选型 | 综合7因素按表3.3.2 | JGJ 120 第3.3.1条 | 未说明选型依据 | 形式与深度/土质不匹配 |")
  lines.push("| 稳定性验算 | 嵌固 K_e≥1.25/1.2/1.15 + 抗隆起 + 滑移 | JGJ 120 第4.2.1条 | 只给结论无计算书/漏抗隆起 | 支护失稳坍塌 |")
  lines.push("| 边坡稳定 | 圆弧滑动面法需完整计算书 | JGJ 120 + 建办质48号 | 缺荷载条件/土参数/工况组合 | 稳定性无法复核 |")
  lines.push("| 监测项目 | 按表4.2.1配置齐全 | GB 50497 第4.2.1条 | 漏深层水平位移/支撑轴力/地下水位 | 监测盲区 |")
  lines.push("| 监测报警 | 6类报警情形须覆盖 | GB 50497 第8.0.9条 | 应急预案漏监测报警联动 | 报警失效 |")
  lines.push("| 降水 | 涌水量+出水量计算+井深井距 | JGJ 111-2016 | 降水井布置无计算依据 | 坑底涌水/降水不足 |")
  lines.push("| 土钉墙深度 | 软土≤6m/直立≤13m/放坡≤18m | GB 50739 第3.0.4条 | 超深用土钉墙无论证 | 整体失稳 |")
  lines.push("| 一二级基坑 | 必须水平位移+沉降监测 | GB 55003 第7.1.5条 | 漏监测或监测项目不足 | 无法预警 |")
  lines.push("| 严禁超挖 | 分层开挖+支护强度达标后挖下层 | GB 55003 第7.4.3 + JGJ 180 | 提前开挖/超挖 | 支护失效 |")
  lines.push("| 基坑边堆载 | 无设计允许禁堆土/料/机具 | JGJ 180 第6.3.9 | 随意堆载 | 支护超载变形 |")
  lines.push("")
  lines.push("> ⚠️ **基坑审核优先级**：支护选型合理性 + 稳定性验算书完整性 + 监测项目齐全 + 降水计算依据——这 4 项是「会死人」的硬指标。审基坑先确认支护形式（放坡/排桩/地连墙/土钉墙/锚杆），再套对应构造条款。")
  lines.push("")
  lines.push("> 📌 **放坡方案特别注意**：放坡开挖看似简单，但「边坡稳定性验算书」（圆弧滑动面法）必须完整——含土层参数、荷载条件（周边超载）、工况组合、安全系数核算。这是放坡基坑最常被忽略的致命点。")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("**导出自**：`lib/clause-db.ts` SEED_CLAUSES（profession=foundation）。改种子后重跑 `npx tsx scripts/export-foundation-checklist.ts` 即可刷新。")

  const out = lines.join("\n")
  const outPath = path.join(process.cwd(), "docs", "深基坑审核清单.md")
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, out, "utf-8")
  console.log(`✅ 已导出：${outPath}`)
  console.log(`   共 ${idx} 条审核项 + 高频易错点附录（10 条）`)
}

main().catch((e) => {
  console.error("导出失败:", e)
  process.exit(1)
})
