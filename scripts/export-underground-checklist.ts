// scripts/export-underground-checklist.ts
// 从 clause.db 导出暗挖工程审核清单（markdown）—— 产品化资产 6
// 运行：npx tsx scripts/export-underground-checklist.ts
// 产出：docs/暗挖工程审核清单.md

import { getAllClauses, type Clause } from "../lib/clause-db"
import fs from "fs"
import path from "path"

const GROUPS: { title: string; subtitle: string; filter: (c: Clause) => boolean }[] = [
  {
    title: "一、盾构法",
    subtitle: "GB50446-2017 + CJJ217-2014 —— 掘进参数、带压开仓、管片拼装、同步注浆与仓内作业锁定",
    filter: (c) => c.profession === "underground" && c.structure_type === "盾构法",
  },
  {
    title: "二、顶管法",
    subtitle: "DBJ/T 15-106-2015《顶管技术规程（广东省）》—— 泥水压力、出土量与禁用人工掘进情形",
    filter: (c) => c.profession === "underground" && c.structure_type === "顶管法",
  },
  {
    title: "三、矿山法",
    subtitle: "GB50086-2015 + TB 10304-2020 —— 初期支护、锚杆地层限制、围岩较差地段初喷封闭",
    filter: (c) => c.profession === "underground" && c.structure_type === "矿山法",
  },
  {
    title: "四、冻结法",
    subtitle: "NB/T 10222-2019《隧道联络通道冻结法施工及验收规范》—— 冻结壁温度、盐水温度与开挖期供冷",
    filter: (c) => c.profession === "underground" && c.structure_type === "冻结法",
  },
  {
    title: "五、暗挖通用条款",
    subtitle: "GB50911-2013 + GB50652-2011 + TB 10304-2020 —— 监测预警、风险分级、通风供风、超前地质预报",
    filter: (c) => c.profession === "underground" && c.structure_type === null,
  },
]

const COMMON_ERROR_OVERRIDES: Record<string, string> = {
  "GB50446-2017|7.5.2": "土仓压力、刀盘转速、掘进速度未结合地质、埋深、监测和试掘进记录确定",
  "GB50446-2017|7.8.6": "开挖仓气压只有经验值，缺计算或保压试验",
  "GB50446-2017|9.1.4": "管片拼装机作业范围内站人或穿行",
  "GB50446-2017|10.2.5": "同步注浆充填系数缺失、低于1.30或超过2.50无分析",
  "CJJ217-2014|3.0.5": "仓内有人时仓外转动刀盘、出渣或泥浆循环",
  "CJJ217-2014|5.2.4": "初次开仓前未做保压试验或保压时间不足2h",
  "DBJ/T 15-106-2015|9.4.2": "泥水压力未控制在高出地下水压力20kPa-40kPa",
  "DBJ/T 15-106-2015|9.5.1": "初始或正常顶进出土量未按理论出土量比例控制",
  "DBJ/T 15-106-2015|9.6.1": "流砂、流泥、涌水地层或穿越水域仍采用人工掘进顶管",
  "GB50086-2015|6.1.2": "喷射混凝土强度、厚度不足或未满足支护稳定要求",
  "GB50086-2015|4.1.4": "永久锚杆锚固段设在未经处理的不良地层",
  "TB 10304-2020|8.1.3": "围岩较差地段爆破找顶后未立即初喷封闭",
  "NB/T 10222-2019|5.2.5-2": "冻结壁平均温度或管片交界面温度未达标即开挖",
  "NB/T 10222-2019|5.2.5-3": "积极冻结期盐水温度7d、15d或开挖前控制值未达标",
  "NB/T 10222-2019|6.6.4": "开挖期间擅自停止或减少冻结孔供冷",
  "GB50911-2013|9.1.5": "未制定预警等级和预警标准，或达到预警值未警情报送",
  "GB50911-2013|表9.2.2-2": "地表沉降、隆起控制值与监测等级不匹配",
  "GB50652-2011|4.3.1": "I级风险未编制风险预警和应急处置方案",
  "TB 10304-2020|11.5.5": "通风供风量、内燃机械供风量或风速不足",
  "TB 10304-2020|5.0.2": "超前地质预报未作为工序纳入施工组织或无专项方案",
}

function extractCommonError(ap: string | null): string {
  if (!ap) return ""
  const m1 = ap.match(/强制性条文[^；。]*?[；。]/)
  if (m1) return m1[0].replace(/[；。]$/, "")
  const m2 = ap.match(/「不得」[^；。]*?[；。]/)
  if (m2) return m2[0].replace(/[；。]$/, "")
  const m3 = ap.match(/<[^；。]*?[；。]/)
  if (m3) return m3[0].replace(/[；。]$/, "")
  return ""
}

function firstSentence(ap: string | null): string {
  if (!ap) return ""
  const s = ap.split(/。[。]/)[0].replace(/^核对[：:]?/, "").trim()
  return s.length > 62 ? s.slice(0, 62) + "..." : s
}

async function main() {
  const all = await getAllClauses()
  const underground = all.filter((c) => c.profession === "underground")
  console.log(`暗挖工程条款共 ${underground.length} 条，开始导出...`)

  const lines: string[] = []
  lines.push("# 暗挖工程审核清单")
  lines.push("")
  lines.push("> 由 clause-db 锚点库自动导出。每条 = 一个审核检查点，含规范依据、审核要点、常见错误。")
  lines.push(`> 共 ${underground.length} 条 = 盾构法 6 + 顶管法 3 + 矿山法 3 + 冻结法 3 + 暗挖通用 5。`)
  lines.push(`> 导出时间：${new Date().toLocaleString("zh-CN")}`)
  lines.push("")
  lines.push("**使用说明**：审核员对照方案，按本清单逐条核查。多专业调度（`getClausesByFeatures` 按 profession 过滤）保障——暗挖方案下自动激活本库，并通过 `structure_type` 区分盾构法、顶管法、矿山法和冻结法。")
  lines.push("")
  lines.push("**核心规范**：")
  lines.push("- **GB50446-2017**《盾构法隧道施工及验收规范》：盾构掘进参数、带压开仓、管片拼装、同步注浆。")
  lines.push("- **CJJ217-2014**《盾构法开仓及气压作业技术规范》：仓内作业锁定、初次开仓保压试验。")
  lines.push("- **DBJ/T 15-106-2015**《顶管技术规程（广东省）》：泥水压力、土压出土量、禁用人工掘进条件。")
  lines.push("- **GB50086-2015**《岩土锚杆与喷射混凝土支护工程技术规范》：喷射混凝土、锚杆地层限制。")
  lines.push("- **NB/T 10222-2019**《隧道联络通道冻结法施工及验收规范》：冻结壁温度、盐水温度、开挖期供冷。")
  lines.push("- **GB50911-2013**、**GB50652-2011**、**TB 10304-2020**：监测预警、风险分级、通风供风和超前地质预报。")
  lines.push("")
  lines.push("## 暗挖弹药库分层")
  lines.push("")
  lines.push("| 层级 | 适用对象 | 关键锚点 | 使用边界 |")
  lines.push("|------|----------|----------|----------|")
  lines.push("| 第一层：暗挖通用控制 | 盾构、顶管、矿山法、冻结法等地下暗挖工程 | GB50911-2013 9.1.5、表9.2.2-2；GB50652-2011 4.3.1；TB 10304-2020 11.5.5、5.0.2 | 审监测预警、风险等级、通风供风、超前地质预报。 |")
  lines.push("| 第二层：机械掘进专用 | 盾构法、顶管法 | GB50446-2017 7.5.2、7.8.6、10.2.5；CJJ217-2014 3.0.5、5.2.4；DBJ/T 15-106-2015 9.4.2、9.5.1 | 审土仓/泥水压力、开仓保压、仓内联锁、同步注浆、出土量。 |")
  lines.push("| 第三层：矿山法/冻结法专用 | 钻爆法、矿山法暗挖、冻结法联络通道 | GB50086-2015 6.1.2、4.1.4；TB 10304-2020 8.1.3；NB/T 10222-2019 5.2.5、6.6.4 | 审初期支护、锚杆地层、初喷封闭、冻结壁和盐水温度、开挖期持续供冷。 |")
  lines.push("")

  let idx = 0
  for (const group of GROUPS) {
    const clauses = underground.filter(group.filter)
    if (clauses.length === 0) continue
    clauses.sort((a, b) => b.priority - a.priority || a.clause_no.localeCompare(b.clause_no))
    lines.push(`## ${group.title}`)
    lines.push(`**${group.subtitle}** — ${clauses.length} 条`)
    lines.push("")
    lines.push("| # | 审核项 | 规范条款 | 审核要点（精简） | 常见错误 |")
    lines.push("|---|--------|----------|------------------|----------|")
    for (const c of clauses) {
      idx++
      const key = `${c.standard_code}|${c.clause_no}`
      const item = c.clause_title.replace(/\|/g, "/")
      const ref = `${c.standard_code} 第${c.clause_no}条`
      const point = firstSentence(c.audit_points).replace(/\|/g, "/")
      const err = (COMMON_ERROR_OVERRIDES[key] || extractCommonError(c.audit_points) || "—").replace(/\|/g, "/")
      lines.push(`| ${idx} | ${item} | ${ref} | ${point} | ${err} |`)
    }
    lines.push("")
  }

  lines.push("## 附录：高频易错点（暗挖工程审核优先核查）")
  lines.push("")
  lines.push("| 类型 | 易错点 | 规范值 | 错误写法 | 后果 |")
  lines.push("|------|--------|--------|----------|------|")
  lines.push("| 盾构法 | 土压平衡掘进参数 | 刀盘转速、掘进速度、土仓压力按地质、埋深、监测、姿态和试掘进经验确定（GB50446 第7.5.2条） | 套用固定土仓压力或无试掘进记录 | 地表沉降、涌水涌砂 |")
  lines.push("| 盾构法 | 气压开仓压力 | 开挖仓气压必须通过计算和试验确定（GB50446 第7.8.6条） | 只有经验压力，无计算或试验 | 开仓失压、突涌 |")
  lines.push("| 盾构法 | 仓内作业联锁 | 严禁仓外作业人员转动刀盘、出渣、泥浆循环（CJJ217 第3.0.5条） | 仓内有人时仓外仍可动作 | 机械伤害 |")
  lines.push("| 盾构法 | 初次开仓保压 | 初次开仓前保压试验，保压时间≥2h（CJJ217 第5.2.4条） | 未保压或保压时间不足 | 仓压失稳 |")
  lines.push("| 盾构法 | 同步注浆 | 充填系数宜为1.30-2.50（GB50446 第10.2.5条） | 注浆量无计算或系数异常无分析 | 沉降、管片背后空洞 |")
  lines.push("| 顶管法 | 泥水压力 | 高出地下水压力20kPa-40kPa（DBJ/T15-106 第9.4.2条） | 泥水压力过低或过高 | 掌子面失稳、冒浆 |")
  lines.push("| 顶管法 | 出土量 | 初始约95%，正常98%-100%理论出土量（DBJ/T15-106 第9.5.1条） | 超挖或出土量无记录 | 地面沉降、塌方 |")
  lines.push("| 顶管法 | 人工掘进禁用 | 流砂、流泥、涌水地层或穿越水域不得采用人工掘进顶管（DBJ/T15-106 第9.6.1条） | 高风险地层仍用人工掘进 | 涌水涌砂、人员伤亡 |")
  lines.push("| 矿山法 | 喷射混凝土 | 强度≥C20，最小厚度≥50mm（GB50086 第6.1.2条） | 初支厚度不足或强度等级偏低 | 初支承载不足 |")
  lines.push("| 矿山法 | 初喷封闭 | 围岩较差地段爆破找顶后立即初喷封闭（TB10304 第8.1.3条） | 初喷滞后或掌子面未封闭 | 围岩松弛坍塌 |")
  lines.push("| 冻结法 | 冻结壁温度 | 管片交界面平均温度不应高于-5摄氏度（NB/T10222 第5.2.5-2条） | 温度未达标即开挖 | 冻结壁失效、涌水 |")
  lines.push("| 冻结法 | 盐水温度 | 7d≤-18摄氏度、15d≤-24摄氏度，开挖前达设计最低值（NB/T10222 第5.2.5-3条） | 积极冻结期温度不足 | 冻结强度不足 |")
  lines.push("| 冻结法 | 开挖期供冷 | 开挖期间不得擅自停止或减少冻结孔供冷（NB/T10222 第6.6.4条） | 停泵停冷无分析和措施 | 冻结壁融化失稳 |")
  lines.push("| 通用 | 监测预警 | 达到预警标准必须警情报送（GB50911 第9.1.5条） | 有预警值无报送流程 | 险情延误 |")
  lines.push("| 通用 | 通风供风 | 每人新鲜空气≥3m3/min，内燃机械≥3m3/(min·kW)，风速达标（TB10304 第11.5.5条） | 通风量按经验配置 | 缺氧、中毒、爆炸风险 |")
  lines.push("| 通用 | 超前地质预报 | 作为工序纳入施工组织并编制专项方案（TB10304 第5.0.2条） | 仅写必要时预报 | 突水突泥、坍塌预判不足 |")
  lines.push("")
  lines.push("> 暗挖审核优先级：先判定工法，再审掌子面稳定和人员安全。盾构看压力、开仓、注浆和仓内联锁；顶管看泥水压力、出土量和人工掘进禁用条件；矿山法看初支、初喷和超前预报；冻结法看冻结壁、盐水温度和持续供冷。")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("**导出自**：`lib/clause-db.ts` SEED_CLAUSES（profession=underground）。改种子后重跑 `npx tsx scripts/export-underground-checklist.ts` 即可刷新本清单。")

  const outPath = path.join(process.cwd(), "docs", "暗挖工程审核清单.md")
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8")
  console.log(`已导出：${outPath}`)
  console.log(`   共 ${idx} 条审核项 + 高频易错点附录（16 条）`)
}

main().catch((error) => {
  console.error("导出失败:", error)
  process.exit(1)
})
