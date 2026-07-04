// scripts/export-crane-checklist.ts
// 从 clause.db 导出起重吊装审核清单（markdown）—— 产品化资产
// 运行：npx tsx scripts/export-crane-checklist.ts
// 产出：docs/起重吊装审核清单.md
//
// 老师第三件·动作一：起重吊装方向跑通后（盾构机吊装方案验证），沉淀审核清单。
// 多专业调度保障：getClausesByFeatures 按 profession 过滤，起重方案下自动激活本库，
// 不混入模板/脚手架规范（DBJ/T 15-197 高大支模监测等已根治）。

import { getAllClauses, type Clause } from "../lib/clause-db"
import fs from "fs"
import path from "path"

const GROUPS: { title: string; subtitle: string; filter: (c: Clause) => boolean }[] = [
  { title: "一、流动式起重机（大型吊装）", subtitle: "JGJ 276-2012《建筑施工起重吊装工程安全技术规范》—— 盾构机/大型设备吊装核心",
    filter: (c) => c.profession === "crane" && c.structure_type === "流动式起重机" },
  { title: "二、塔式起重机", subtitle: "JGJ/T 187-2019 基础 + GB5144-2006 安全规程 + JGJ 332-2014 监控 + JGJ 196-2010 安拆",
    filter: (c) => c.profession === "crane" && c.structure_type === "塔式起重机" },
  { title: "三、施工升降机", subtitle: "JGJ 215-2010《建筑施工升降机安装、使用、拆卸安全技术规程》+ GB/T 34023",
    filter: (c) => c.profession === "crane" && c.structure_type === "施工升降机" },
  { title: "四、物料提升机", subtitle: "JGJ 88-2010《龙门架及井架物料提升机安全技术规范》",
    filter: (c) => c.profession === "crane" && c.structure_type === "物料提升机" },
  { title: "五、起重吊装通用条款", subtitle: "吊钩报废 / 钢丝绳报废 / 特种作业持证等（跨机械类型）",
    filter: (c) => c.profession === "crane" && c.structure_type === null },
]

// 从 audit_points 提取「常见错误」
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
  const crane = all.filter((c) => c.profession === "crane")
  console.log(`起重吊装条款共 ${crane.length} 条，开始导出…`)

  const lines: string[] = []
  lines.push("# 起重吊装审核清单")
  lines.push("")
  lines.push("> 由 clause-db 锚点库自动导出。每条 = 一个审核检查点，含规范依据、审核要点、常见错误。")
  lines.push(`> 共 ${crane.length} 条 = 流动式（JGJ 276）+ 塔吊（JGJ/T 187/GB5144/JGJ 332/JGJ 196）+ 升降机（JGJ 215）+ 物料机（JGJ 88）+ 通用。`)
  lines.push(`> 导出时间：${new Date().toLocaleString("zh-CN")}`)
  lines.push("")
  lines.push("**使用说明**：审核员对照方案，按本清单逐条核查。多专业调度系统（`getClausesByFeatures` 按 profession 过滤）已保障——起重方案下自动激活本库，**不会混入模板支撑的 DBJ/T 15-197 高大支模监测等跨专业规范**。")
  lines.push("")
  lines.push("**核心规范**：")
  lines.push("- 流动式（盾构机/大型设备吊装）：**JGJ 276-2012**《建筑施工起重吊装工程安全技术规范》")
  lines.push("- 塔吊：JGJ/T 187-2019（基础）/ GB 5144-2006（安全规程）/ JGJ 332-2014（监控）/ JGJ 196-2010（安拆）")
  lines.push("- 升降机：JGJ 215-2010 / 物料机：JGJ 88-2010")
  lines.push("- 通用：GB/T 5972（钢丝绳）/ 建设部令 166 号（特种作业持证）")
  lines.push("")

  let idx = 0
  for (const g of GROUPS) {
    const clauses = crane.filter(g.filter)
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
      const ref = `${c.standard_code} 第${c.clause_no}条`
      const point = firstSentence(c.audit_points)
      const err = extractCommonError(c.audit_points) || "—"
      lines.push(`| ${idx} | ${item} | ${ref} | ${point} | ${err} |`)
    }
    lines.push("")
  }

  // 高频易错点附录（基于深圳西部物流站盾构机吊装方案真实审核案例）
  lines.push("## 附录：高频易错点（来自盾构机吊装真实审核案例）")
  lines.push("")
  lines.push("以下为大型吊装审核中反复出现的错误，属「高频踩坑点」，审核时优先核查：")
  lines.push("")
  lines.push("| 类型 | 易错点 | 规范值 | 错误写法 | 后果 |")
  lines.push("|------|--------|--------|----------|------|")
  lines.push("| 流动式 | 试吊高度 | 离地 200-300mm 暂停检查（JGJ 276 第3.0.17条）| 写成 0.2m/0.1m 或未明确暂停 | 检查程序失效 |")
  lines.push("| 流动式 | 双机抬吊载荷 | 单机≤额定 80% + 提供分配计算书（第3.0.15条）| 只写「符合80%要求」无计算书 | 超载/分配不合理 |")
  lines.push("| 流动式 | 吊具选型 | 吊索/卡环/卸扣规格须计算（第3.0.7条）| 只给规格无计算书 | 强度不足断裂 |")
  lines.push("| 流动式 | 吊点设置 | 无设计吊环时计算确定（第5.1.5条）| 直接用原厂吊耳不验算 | 吊耳撕裂 |")
  lines.push("| 流动式 | 吊索安全系数 | 重大构件取 10（第4.3.1条）| 取 6 或未明确 | 钢丝绳断裂 |")
  lines.push("| 流动式 | 吊索水平夹角 | >45°，小于时用平衡梁（第4.3.1条）| 不说明小于45°的措施 | 吊索受力过大 |")
  lines.push("| 流动式 | 吊装警戒 | 四周设标志+专人警戒（第3.0.5条）| 仅危险源分析提及 | 非操作人员入内 |")
  lines.push("| 流动式 | 吊耳应力计算 | 应力=荷载/面积，k 体现于容许应力折减（GB 50017）| 安全系数 k 直接乘在荷载上 | 掩盖真实安全裕度 |")
  lines.push("| 塔吊 | 力矩限制器 | 强制设置并灵敏（GB 5144 第6.2.1条）| 未装或失效 | 超载倒塔 |")
  lines.push("| 塔吊 | 群塔防碰撞 | 安全距离（GB 5144 第10.5条）| 未核算塔机间距 | 塔机碰撞 |")
  lines.push("| 升降机 | 防坠安全器 | 按期标定（JGJ 215 第4.1.7条）| 超期未标定 | 吊笼坠落 |")
  lines.push("| 物料机 | 严禁载人 | 强制（JGJ 88 第11.0.3条）| 人货混装 | 坠落伤亡 |")
  lines.push("")
  lines.push("> ⚠️ **大型吊装审核优先级**：试吊高度 / 双机抬吊载荷分配 / 吊具与吊点计算书 / 吊索安全系数——这 4 项是「会死人」的硬指标，必须逐项核查计算书，不能只看规格。")
  lines.push("")
  lines.push("> 📌 **吊耳应力计算说明**：JGJ 276 第3.0.7 是原则性条款（吊具须计算），具体应力算法（正应力 δ=P/F、切应力 τ=P/A）应执行《钢结构设计标准》GB 50017-2017。当前锚点库尚未收录 GB 50017 吊耳应力条款，审核时如遇吊耳计算问题，需人工对照 GB 50017 第11章复核。")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("**导出自**：`lib/clause-db.ts` SEED_CLAUSES（profession=crane）。改种子后重跑 `npx tsx scripts/export-crane-checklist.ts` 即可刷新本清单。")

  const out = lines.join("\n")
  const outPath = path.join(process.cwd(), "docs", "起重吊装审核清单.md")
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, out, "utf-8")
  console.log(`✅ 已导出：${outPath}`)
  console.log(`   共 ${idx} 条审核项 + 高频易错点附录（12 条）`)
}

main().catch((e) => {
  console.error("导出失败:", e)
  process.exit(1)
})
