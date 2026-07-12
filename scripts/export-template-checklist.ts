// scripts/export-template-checklist.ts
// 从 clause.db 导出模板支撑审核清单（markdown）—— 产品化资产
// 运行：npx tsx scripts/export-template-checklist.ts
// 产出：docs/模板支撑审核清单.md
//
// 老师第三件：把跑通的锚点库导出成可交付的审核检查表（审核项/规范/审核要点/常见错误）。

import { getAllClauses, type Clause } from "../lib/clause-db"
import { formatClauseReference } from "../lib/clauses/clause-reference"
import fs from "fs"
import path from "path"

const GROUPS: { title: string; subtitle: string; filter: (c: Clause) => boolean }[] = [
  { title: "一、盘扣式模板支撑", subtitle: "JGJ/T 231-2021《建筑施工承插型盘扣式钢管脚手架安全技术标准》",
    filter: (c) => c.profession === "template" && c.structure_type === "盘扣式" },
  { title: "二、轮扣式模板支撑", subtitle: "DB44/T 1876-2016《轮扣式钢管脚手架安全技术规程》",
    filter: (c) => c.profession === "template" && c.structure_type === "轮扣式" },
  { title: "三、扣件式模板支撑", subtitle: "JGJ 130-2011《建筑施工扣件式钢管脚手架安全技术规范》",
    filter: (c) => c.profession === "template" && c.structure_type === "扣件式" },
  { title: "四、碗扣式模板支撑", subtitle: "JGJ 166-2016《建筑施工碗扣式钢管脚手架安全技术规范》",
    filter: (c) => c.profession === "template" && c.structure_type === "碗扣式" },
  { title: "五、套扣式模板支撑", subtitle: "DBJ/T 15-98-2019《建筑施工承插型套扣式钢管脚手架安全技术规程》",
    filter: (c) => c.profession === "template" && c.structure_type === "套扣式" },
  { title: "六、门式模板支撑", subtitle: "JGJ/T 128-2019《建筑施工门式钢管脚手架安全技术标准》",
    filter: (c) => c.profession === "template" && c.structure_type === "门式" },
  { title: "七、模板支撑通用条款", subtitle: "高大支模监测 / 剪刀撑通用 / 连墙抱柱 / 拆除作业等（DBJ/T 15-197、JGJ 300、GB 55023 等）",
    filter: (c) => c.profession === "template" && c.structure_type === null },
]

// 从 audit_points 提取「常见错误」——抓"方案若…即不符/即违反""方案笼统写…""不得套用…"等句式
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

// 审核要点取 audit_points 第一句（到第一个句号），过长截断
function firstSentence(ap: string | null): string {
  if (!ap) return ""
  const s = ap.split(/。[。]/)[0].replace(/^核对[：:]?/, "").trim()
  return s.length > 55 ? s.slice(0, 55) + "…" : s
}

async function main() {
  const all = await getAllClauses()
  const template = all.filter((c) => c.profession === "template")
  console.log(`模板支撑条款共 ${template.length} 条，开始导出…`)

  const lines: string[] = []
  lines.push("# 模板支撑体系审核清单")
  lines.push("")
  lines.push("> 由 clause-db 锚点库自动导出。每条 = 一个审核检查点，含规范依据、审核要点、常见错误。")
  lines.push(`> 共 ${template.length} 条 = 盘扣 10 + 轮扣 5 + 扣件 5 + 碗扣 5 + 套扣 4 + 门式 3 + 通用 11。`)
  lines.push(`> 导出时间：${new Date().toLocaleString("zh-CN")}`)
  lines.push("")
  lines.push("**使用说明**：审核员对照方案，按本清单逐条核查。同一问题若涉及多个体系（如盘扣/轮扣丝杆外露限值不同），务必先确认方案采用的支撑体系，再套对应数值——**盘扣式与轮扣式数值常混淆，是最高频错误**。")
  lines.push("")

  let idx = 0
  for (const g of GROUPS) {
    const clauses = template.filter(g.filter)
    if (clauses.length === 0) continue
    // 按 priority 降序、clause_no 升序排（重要的在前）
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

  // 高频易错点附录（基于清华附中等真实审核报告提炼）
  lines.push("## 附录：高频易错点（来自真实审核案例）")
  lines.push("")
  lines.push("以下为审核中反复出现的错误，属「高频踩坑点」，审核时优先核查：")
  lines.push("")
  lines.push("| 体系 | 易错点 | 规范值 | 错误写法 | 后果 |")
  lines.push("|------|--------|--------|----------|------|")
  lines.push("| 盘扣式 | 立杆壁厚 | ≥3.2mm（JGJ/T 231 第3.0.1条 + JG/T 503） | Φ48×3.0（壁厚3.0） | 承载力不足、架体失稳 |")
  lines.push("| 盘扣式 | 丝杆外露长度 | ≤400mm（第6.2.4条） | ≤300mm（混用轮扣式限值） | 误删合规做法 / 构造不符 |")
  lines.push("| 盘扣式 | 竖向斜杆布置 | 按Nmax×H查表6.2.2 | 自己编固定跨数、不区分N与H | 抗侧覆不足 |")
  lines.push("| 盘扣式 | 立杆垂直度 | ≤L/500且≤50mm（附录D） | h/1050、±l/600 | 验收标准过松 |")
  lines.push("| 盘扣式 | 步距 | ≤2m（第6.1.3条） | >2m | 立杆承载力下降 |")
  lines.push("| 盘扣式 | 竖向斜杆材质 | 盘扣专用斜杆（第6.1.4条） | 用钢管扣件替代 | 节点失效 |")
  lines.push("| 轮扣式 | 丝杆外露长度 | ≤300mm（DB44/T 1876 第7.1.6条） | 混用盘扣式400mm | 误判合规 |")
  lines.push("| 轮扣式 | 步距（高大模板） | ≤1.2m（第9.2.2条） | >1.2m | 高大模板失稳 |")
  lines.push("| 扣件式 | 钢管壁厚 | Φ48.3×3.6（JGJ 130 第3.1.2条） | Φ48×3.0 | 承载力不足 |")
  lines.push("| 扣件式 | 扫地杆高度 | ≤200mm（第6.3.2条） | 混用盘扣/轮扣550mm | 构造不符 |")
  lines.push("| 高大支模 | 监测点间距 | 10-15m 网格（DBJ/T 15-197 第5.1.2条） | 20-25m | 监测盲区 |")
  lines.push("| 高大支模 | 浇筑期监测频率 | ≥2次/min（第7.0.3条） | 仅写「实时监测」无量化 | 难执行、难验收 |")
  lines.push("| 高大支模 | 监测报警值 | 基于本工程设计计算值（第8.0.4条） | 套用12kN/10kN/固定数 | 报警失效 |")
  lines.push("| 高大支模 | 应急报警情形 | 6类强制情形（第8.0.5条） | 仅写触电/火灾等通用预案 | 漏监测报警联动 |")
  lines.push("")
  lines.push("> ⚠️ **盘扣式 vs 轮扣式 数值对照（最易混）**：丝杆外露 400/300、步距 2/1.2、立杆 48.3/48、扫地杆 550/550（同）、单根轴力 无限值/≤12kN。审核前先定体系，再套数值。")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("**导出自**：`lib/clause-db.ts` SEED_CLAUSES（profession=template）。改种子后重跑 `npx tsx scripts/export-template-checklist.ts` 即可刷新本清单。")

  const out = lines.join("\n")
  const outPath = path.join(process.cwd(), "docs", "模板支撑审核清单.md")
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, out, "utf-8")
  console.log(`✅ 已导出：${outPath}`)
  console.log(`   共 ${idx} 条审核项 + 高频易错点附录（14 条）`)
}

main().catch((e) => {
  console.error("导出失败:", e)
  process.exit(1)
})
