// scripts/export-scaffolding-checklist.ts
// 从 clause.db 导出脚手架工程审核清单（markdown）—— 产品化资产 4
// 运行：npx tsx scripts/export-scaffolding-checklist.ts
// 产出：docs/脚手架工程审核清单.md
//
// 第四个专业方向：脚手架工程。清单来源于脚手架审核依据目录下的 JGJ 130、JGJ 202、
// GB 55023、JGJ 80 等规范锚点，并由 getClausesByFeatures 按 profession=scaffolding 调度。

import { getAllClauses, type Clause } from "../lib/clause-db"
import fs from "fs"
import path from "path"

const GROUPS: { title: string; subtitle: string; filter: (c: Clause) => boolean }[] = [
  {
    title: "一、落地式脚手架",
    subtitle: "JGJ 130-2011《建筑施工扣件式钢管脚手架安全技术规范》—— 单/双排落地外脚手架核心",
    filter: (c) => c.profession === "scaffolding" && c.structure_type === "落地式脚手架",
  },
  {
    title: "二、悬挑式脚手架",
    subtitle: "JGJ 130-2011《建筑施工扣件式钢管脚手架安全技术规范》—— 型钢悬挑梁、锚固与卸荷",
    filter: (c) => c.profession === "scaffolding" && c.structure_type === "悬挑式脚手架",
  },
  {
    title: "三、附着式升降脚手架",
    subtitle: "JGJ 202-2010《建筑施工工具式脚手架安全技术规范》+ GB55023-2022《施工脚手架通用规范》",
    filter: (c) => c.profession === "scaffolding" && c.structure_type === "附着升降式脚手架",
  },
  {
    title: "四、高处作业吊篮",
    subtitle: "JGJ 202-2010《建筑施工工具式脚手架安全技术规范》—— 悬挂机构、配重、安全绳与安全锁扣",
    filter: (c) => c.profession === "scaffolding" && c.structure_type === "吊篮",
  },
  {
    title: "五、卸料平台/操作平台",
    subtitle: "JGJ 80-2016《建筑施工高处作业安全技术规范》+ GB55023-2022《施工脚手架通用规范》—— 平台设计、支承、钢丝绳、限载与防护",
    filter: (c) =>
      c.profession === "scaffolding" &&
      (c.structure_type === "卸料平台" || (c.structure_type === null && c.standard_code === "JGJ 80-2016")),
  },
  {
    title: "六、脚手架通用原则",
    subtitle: "GB55023-2022《施工脚手架通用规范》—— 连墙件、剪刀撑、搭设同步与使用禁令",
    filter: (c) => c.profession === "scaffolding" && c.structure_type === null && c.standard_code !== "JGJ 80-2016",
  },
]

const COMMON_ERROR_OVERRIDES: Record<string, string> = {
  "JGJ 130-2011|6.1.2": "单排超过24m仍按普通单排搭设",
  "JGJ 130-2011|6.3.4": "首步步距大于2m",
  "JGJ 130-2011|6.3.3": "高差处扫地杆未延长或靠边坡过近",
  "JGJ 130-2011|6.10.1": "一段悬挑高度超过20m",
  "JGJ 130-2011|6.10.2": "未明确型钢型号或截面高度小于160mm",
  "JGJ 130-2011|6.10.4": "把钢丝绳/钢拉杆计入悬挑钢梁受力计算",
  "JGJ 130-2011|6.10.5": "固定段长度不足或锚固件少于2个",
  "JGJ 130-2011|6.10.8": "楼板厚度小于120mm仍直接锚固",
  "GB 55023-2022|4.4.9": "附墙支座、停层、防倾、防坠、同步控制缺项",
  "JGJ 202-2010|4.5.1": "设备清单缺防倾覆、防坠落或同步升降控制装置",
  "JGJ 202-2010|4.5.2": "导向件数量不足或导向间距不满足要求",
  "JGJ 202-2010|4.5.3": "采用手动防坠或防坠装置与升降设备未独立固定",
  "JGJ 202-2010|4.5.4": "只写同步控制，未明确15%报警、30%停机和30mm高差停机",
  "JGJ 202-2010|5.4.10": "用沙袋、混凝土块等替代标准配重",
  "JGJ 202-2010|5.4.7": "前支架支撑在女儿墙、女儿墙外或挑檐边缘",
  "JGJ 202-2010|5.5.1": "安全绳系挂在吊篮构件上",
  "JGJ 202-2010|5.4.12": "悬挂机构吊点与平台吊点间距误差超过50mm",
  "JGJ 80-2016|6.1.1": "卸料平台无专项方案或缺少结构计算",
  "JGJ 80-2016|6.1.2": "平台材料、脚手板承载力或固定措施未明确",
  "JGJ 80-2016|6.1.4": "只有设计荷载，现场未设限载牌或未限定人数",
  "JGJ 80-2016|6.4.1": "卸料平台支承或拉结落在外架、临设上",
  "JGJ 80-2016|6.4.2": "悬挑长度、平台荷载超限或悬挑梁未锚固",
  "JGJ 80-2016|6.4.3": "钢丝绳只写安全储备，不参与平台受力验算",
  "JGJ 80-2016|6.4.5": "用钢管制作悬挑梁或节点、预埋件、焊缝未计算",
  "JGJ 80-2016|6.4.6": "吊环数量不足或吊钩直接钩挂吊环",
  "JGJ 80-2016|6.4.7": "钢丝绳夹少于4个或锐角处无防割软垫",
  "JGJ 80-2016|6.4.10": "悬挑式操作平台未按附录C进行结构计算",
  "JGJ 80-2016|C.0.4": "未计算钢丝绳拉力标准值和安全系数",
  "GB 55023-2022|4.4.4": "脚手板未满铺、外侧未封闭或水平防护缺失",
  "GB 55023-2022|4.4.6": "采用柔性连墙件或连墙件间距超限",
  "GB 55023-2022|4.4.7": "剪刀撑不连续、宽度不足或角度不符",
  "GB 55023-2022|5.2.1": "一次搭设超过最上层连墙件2步或自由高度超过4m",
  "GB 55023-2022|5.3.3": "把卸料平台、泵管、缆风绳或起重设备固定在作业脚手架上",
}

function extractCommonError(ap: string | null): string {
  if (!ap) return ""
  const m1 = ap.match(/方案若[^，。；]*?(即不符|即违反|违规|严重违规)/)
  if (m1) return m1[0].replace(/(即不符(合)?|即违反|即违规|严重违规)[，。；]?$/, "")
  const m2 = ap.match(/方案[^，。；]*?(未明确|采用|固定|支撑|写成|直接锚固)[^，。；]*?(即不符|即违规|严重违规|不符)/)
  if (m2) return m2[0].replace(/(即不符(合)?|即违规|严重违规|不符)[，。；]?$/, "")
  const m3 = ap.match(/严禁[^，。；]*?[，。；]/)
  if (m3) return m3[0].replace(/[，。；]$/, "")
  return ""
}

function firstSentence(ap: string | null): string {
  if (!ap) return ""
  const s = ap.split(/。[。]/)[0].replace(/^核对[：:]?/, "").trim()
  return s.length > 62 ? s.slice(0, 62) + "…" : s
}

async function main() {
  const all = await getAllClauses()
  const scaffolding = all.filter((c) => c.profession === "scaffolding")
  console.log(`脚手架工程条款共 ${scaffolding.length} 条，开始导出...`)

  const lines: string[] = []
  lines.push("# 脚手架工程审核清单")
  lines.push("")
  lines.push("> 由 clause-db 锚点库自动导出。每条 = 一个审核检查点，含规范依据、审核要点、常见错误。")
  lines.push(`> 共 ${scaffolding.length} 条 = 落地式 3 + 悬挑式 5 + 附着升降式 5 + 吊篮 4 + 卸料平台/操作平台 12 + 通用原则 4。`)
  lines.push(`> 导出时间：${new Date().toLocaleString("zh-CN")}`)
  lines.push("")
  lines.push("**使用说明**：审核员对照方案，按本清单逐条核查。多专业调度（`getClausesByFeatures` 按 profession 过滤）保障——脚手架方案下自动激活本库，并通过 `structure_type` 区分落地式、悬挑式、附着升降式、吊篮和卸料平台，避免混入模板支撑体系条款。")
  lines.push("")
  lines.push("**依据来源目录**：`方案审核依据/专业法律法规标准规范审核依据/房屋建筑工程/安全类方案审核/2危大工程专项方案/4脚手架工程/`")
  lines.push("")
  lines.push("**核心规范**：")
  lines.push("- **JGJ 130-2011**《建筑施工扣件式钢管脚手架安全技术规范》：落地式、悬挑式脚手架核心构造。")
  lines.push("- **JGJ 202-2010**《建筑施工工具式脚手架安全技术规范》：附着式升降脚手架、高处作业吊篮安全装置。")
  lines.push("- **GB55023-2022**《施工脚手架通用规范》：作业脚手架连墙件、剪刀撑、作业层防护、搭设与使用禁令。")
  lines.push("- **JGJ 80-2016**《建筑施工高处作业安全技术规范》：卸料/操作平台设计计算、主体结构支承、钢丝绳验算、吊环与限载控制。")
  lines.push("")
  lines.push("## 脚手架弹药库三层分层")
  lines.push("")
  lines.push("| 层级 | 适用对象 | 关键锚点 | 使用边界 |")
  lines.push("|------|----------|----------|----------|")
  lines.push("| 第一层：脚手架通用原则 | 作业脚手架、悬挑脚手架、混合方案外架章节 | GB55023-2022 4.4.6、4.4.7、5.2.1、5.3.3 | 审连墙件刚性、剪刀撑、自由高度、严禁将卸料平台/泵管固定在作业脚手架上。 |")
  lines.push("| 第二层：悬挑脚手架专用 | 型钢悬挑脚手架、拉杆式悬挑外架 | JGJ 130-2011 6.10.1、6.10.2、6.10.4、6.10.5、6.10.8 | 审悬挑高度、悬挑钢梁、固定段、锚固件、楼板厚度；当前本地依据库暂无 JGJ 130-2024 原文，暂按本地 JGJ 130-2011 条款执行。 |")
  lines.push("| 第三层：卸料平台专用 | 悬挑式卸料平台、操作平台、接料平台 | JGJ 80-2016 6.1.1、6.1.4、6.4.1、6.4.3、6.4.5、6.4.7、C.0.4 | 审平台专项方案、主体结构支承、平台钢丝绳受力、安全系数、绳夹数量、限载管理；不用于悬挑外脚手架拉杆节点本体审查。 |")
  lines.push("")

  let idx = 0
  for (const g of GROUPS) {
    const clauses = scaffolding.filter(g.filter)
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
      const point = firstSentence(c.audit_points).replace(/\|/g, "/")
      const err = (COMMON_ERROR_OVERRIDES[`${c.standard_code}|${c.clause_no}`] || extractCommonError(c.audit_points) || "—").replace(/\|/g, "/")
      lines.push(`| ${idx} | ${item} | ${ref} | ${point} | ${err} |`)
    }
    lines.push("")
  }

  lines.push("## 附录：高频易错点（脚手架工程审核优先核查）")
  lines.push("")
  lines.push("| 类型 | 易错点 | 规范值 | 错误写法 | 后果 |")
  lines.push("|------|--------|--------|----------|------|")
  lines.push("| 落地式 | 单排/双排搭设高度 | 单排≤24m，双排宜≤50m（JGJ 130 第6.1.2条） | 单排超过24m仍按普通单排搭设 | 架体整体稳定不足 |")
  lines.push("| 落地式 | 底层步距 | ≤2m（JGJ 130 第6.3.4条） | 首步步距大于2m | 立杆薄弱段失稳 |")
  lines.push("| 落地式 | 基础高差与边坡距离 | 高低差≤1m，靠边坡立杆轴线距边坡≥500mm（JGJ 130 第6.3.3条） | 高差处扫地杆未延长、靠边坡过近 | 基础失稳、局部沉陷 |")
  lines.push("| 悬挑式 | 一次悬挑高度 | ≤20m（JGJ 130 第6.10.1条） | 一段悬挑超过20m | 悬挑体系超限 |")
  lines.push("| 悬挑式 | 型钢悬挑梁 | 截面高度≥160mm，尾端两处及以上固定（JGJ 130 第6.10.2条） | 未明确型钢型号或小于160mm | 悬挑梁承载不足 |")
  lines.push("| 悬挑式 | 固定段长度 | 固定段≥悬挑段1.25倍，固定端≥2个锚固件（JGJ 130 第6.10.5条） | 固定段长度不足或只有1道锚固 | 倾覆风险 |")
  lines.push("| 悬挑式 | 楼板锚固厚度 | 楼板厚度宜≥120mm，不足须加固（JGJ 130 第6.10.8条） | 薄板直接锚固未加固 | 锚固失效 |")
  lines.push("| 卸料平台 | 专项方案与设计计算 | 操作平台应通过设计计算并编制专项方案（JGJ 80 第6.1.1条） | 只有搭设做法，无平台结构计算 | 承载体系不明 |")
  lines.push("| 卸料平台 | 主体结构支承 | 搁置点、拉结点、支撑点设在稳定主体结构并可靠连接（JGJ 80 第6.4.1条） | 支承或拉结落在外架、临设上 | 平台倾覆、外架失稳 |")
  lines.push("| 卸料平台 | 悬挑长度与荷载 | 悬挑长度≤5m，均布荷载≤5.5kN/m²，集中荷载≤15kN（JGJ 80 第6.4.2条） | 平台超长、超载或悬挑梁未锚固 | 主梁承载不足 |")
  lines.push("| 卸料平台 | 斜拉钢丝绳受力 | 每一道钢丝绳应能承载该侧所有荷载（JGJ 80 第6.4.3条） | 钢丝绳只作安全储备，不参与计算 | 拉结体系失效 |")
  lines.push("| 卸料平台 | 钢丝绳验算 | 计算拉力标准值并验算安全系数，K取10（JGJ 80 附录C.0.4） | 无钢丝绳拉力和安全系数计算 | 钢丝绳承载不足 |")
  lines.push("| 卸料平台 | 钢丝绳夹 | 钢丝绳夹数量与直径匹配且不少于4个（JGJ 80 第6.4.7条） | 绳夹少于4个或无防割软垫 | 连接滑脱、断绳 |")
  lines.push("| 附着升降式 | 三类安全装置 | 防倾覆、防坠落、同步升降控制缺一不可（JGJ 202 第4.5.1条） | 设备清单缺防坠/同步控制 | 爬架坠落或倾覆 |")
  lines.push("| 附着升降式 | 防坠装置 | 每升降点至少1个、机械式全自动、制动距离受限（JGJ 202 第4.5.3条） | 手动复位或与升降设备不独立 | 防坠失效 |")
  lines.push("| 附着升降式 | 同步控制 | 超载15%报警、30%停机，两端高差30mm停机（JGJ 202 第4.5.4条） | 只写同步控制，无报警/停机阈值 | 升降不同步、架体扭曲 |")
  lines.push("| 吊篮 | 前支架位置 | 严禁支撑在女儿墙、女儿墙外或挑檐边缘（JGJ 202 第5.4.7条） | 前支架落在女儿墙上 | 悬挂机构失稳 |")
  lines.push("| 吊篮 | 配重件 | 稳定安放、有防移动措施，严禁破损或替代物（JGJ 202 第5.4.10条） | 用沙袋/混凝土块替代标准配重 | 抗倾覆不足 |")
  lines.push("| 吊篮 | 安全绳 | 独立固定在建筑物可靠位置，严禁与吊篮连接（JGJ 202 第5.5.1条） | 安全绳系在吊篮构件上 | 坠落保护失效 |")
  lines.push("| 卸料平台 | 限载牌与人数 | 明显位置设置限载牌并限定作业人数（JGJ 80 第6.1.4条） | 只有设计荷载，无现场限载牌 | 超载使用 |")
  lines.push("| 通用 | 连墙件 | 刚性连墙件，水平≤3跨、竖向≤3步、悬臂≤2步（GB55023 第4.4.6条） | 柔性拉结或间距超限 | 架体侧向失稳 |")
  lines.push("| 通用 | 竖向剪刀撑 | 4-6跨、6-9m、45°-60°；≥24m全外侧连续（GB55023 第4.4.7条） | 剪刀撑不连续或角度不符 | 架体抗侧刚度不足 |")
  lines.push("| 通用 | 使用禁令 | 严禁把卸料平台、泵管、缆风绳、大型设备支承件固定在作业脚手架上（GB55023 第5.3.3条） | 卸料平台/泵管固定于外架 | 超载、振动、倾覆 |")
  lines.push("")
  lines.push("> ⚠️ **脚手架审核优先级**：先判定架体类型（落地式/悬挑式/附着升降式/吊篮/卸料平台），再核查关键失稳点。落地式看高度、基础和连墙件；悬挑式看型钢梁、锚固和固定段；附着升降式看防倾、防坠、同步控制；吊篮看悬挂机构、配重和独立安全绳。")
  lines.push("")
  lines.push("> 📌 **与模板支撑的边界**：脚手架工程这里审的是作业脚手架、悬挑外架、爬架、吊篮、卸料/操作平台。模板支撑架的盘扣/轮扣/扣件式支撑参数仍归 `template` 专业，不应把模板支撑的高大支模监测条款套入脚手架工程。")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("**导出自**：`lib/clause-db.ts` SEED_CLAUSES（profession=scaffolding）。改种子后重跑 `npx tsx scripts/export-scaffolding-checklist.ts` 即可刷新本清单。")

  const out = lines.join("\n")
  const outPath = path.join(process.cwd(), "docs", "脚手架工程审核清单.md")
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, out, "utf-8")
  console.log(`已导出：${outPath}`)
  console.log(`   共 ${idx} 条审核项 + 高频易错点附录（23 条）`)
}

main().catch((e) => {
  console.error("导出失败:", e)
  process.exit(1)
})
