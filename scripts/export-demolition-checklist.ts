// scripts/export-demolition-checklist.ts
// 从 clause.db 导出拆除爆破审核清单（markdown）—— 产品化资产 5
// 运行：npx tsx scripts/export-demolition-checklist.ts
// 产出：docs/拆除爆破审核清单.md

import { getAllClauses, type Clause } from "../lib/clause-db"
import { formatClauseReference } from "../lib/clauses/clause-reference"
import fs from "fs"
import path from "path"

const GROUPS: { title: string; subtitle: string; filter: (c: Clause) => boolean }[] = [
  {
    title: "一、人工拆除",
    subtitle: "JGJ 147-2016《建筑拆除工程安全技术规范》—— 人工拆除顺序、交叉作业、墙体拆除与构件下落控制",
    filter: (c) => c.profession === "demolition" && c.structure_type === "人工拆除",
  },
  {
    title: "二、机械拆除",
    subtitle: "JGJ 147-2016《建筑拆除工程安全技术规范》—— 机械拆除顺序、机械作业高度、双机起吊与人机隔离",
    filter: (c) => c.profession === "demolition" && c.structure_type === "机械拆除",
  },
  {
    title: "三、爆破拆除",
    subtitle: "JGJ 147-2016 + GB6722-2014 + GA991-2012 + GA53-2015 —— 爆破安全距离、防护覆盖、盲炮、公告与人员资格",
    filter: (c) => c.profession === "demolition" && c.structure_type === "爆破拆除",
  },
  {
    title: "四、拆除通用条款",
    subtitle: "JGJ 147-2016《建筑拆除工程安全技术规范》—— 断水电气、禁止立体交叉、安全技术交底",
    filter: (c) => c.profession === "demolition" && c.structure_type === null,
  },
]

const COMMON_ERROR_OVERRIDES: Record<string, string> = {
  "JGJ 147-2016|5.1.1": "未按自上而下逐层、分段拆除，或存在垂直交叉作业",
  "JGJ 147-2016|5.1.2": "水平构件上人员聚集或集中堆放物料",
  "JGJ 147-2016|5.1.3": "墙体底部掏掘、牵引推倒或底部切断",
  "JGJ 147-2016|5.1.5": "梁或悬挑构件拆除无控制下落措施",
  "JGJ 147-2016|5.2.2": "机械拆除先拆承重结构或未分段逐层拆除",
  "JGJ 147-2016|5.2.3": "机械前端工作装置作业高度不大于拟拆除物高度",
  "JGJ 147-2016|5.2.6": "双机起吊未控制单机载荷80%、未试吊或不同步作业",
  "JGJ 147-2016|5.2.9": "人工与机械在同一作业面同时作业",
  "JGJ 147-2016|5.3.4": "未分别核算振动、冲击波、飞散物并按GB6722取控制距离",
  "JGJ 147-2016|5.3.7": "防护覆盖材料、固定方式或起爆前验收签字缺失",
  "JGJ 147-2016|5.3.9": "爆后未检查盲炮、爆堆、拆除效果和周边环境影响",
  "GB6722-2014|13.1.1": "只给单一安全距离，未按各类有害效应分别核定并取最大值",
  "GB6722-2014|13.6.1": "飞散物对人员安全距离小于表10要求或未考虑下坡方向增大",
  "GB6722-2014|6.9.1.5": "盲炮处理时强行拉出炮孔中的起爆药包或雷管",
  "GB6722-2014|6.9.1.2": "盲炮处理人员资质或审批程序缺失",
  "GA991-2012|5.2.2.1": "爆破前1天未发布公告或公告五要素不全",
  "GA53-2015|7.1.3": "爆破员、安全员、保管员由同一人员兼任",
  "JGJ 147-2016|3.0.6": "未先切断水电气或先拆承重主体结构",
  "JGJ 147-2016|3.0.7": "同一垂直空间存在立体交叉拆除作业",
  "JGJ 147-2016|6.0.3": "缺少书面安全技术交底记录或签字确认",
}

function extractCommonError(ap: string | null): string {
  if (!ap) return ""
  const m1 = ap.match(/凡出现[^，。；]*?(即违规|即重大违规|违规)/)
  if (m1) return m1[0].replace(/(即重大违规|即违规|违规)[，。；]?$/, "")
  const m2 = ap.match(/只给[^，。；]*?(即不合规|不合规)/)
  if (m2) return m2[0].replace(/(即不合规|不合规)[，。；]?$/, "")
  const m3 = ap.match(/严禁[^，。；]*?[，。；]/)
  if (m3) return m3[0].replace(/[，。；]$/, "")
  return ""
}

function firstSentence(ap: string | null): string {
  if (!ap) return ""
  const s = ap.split(/。[。]/)[0].replace(/^核对[：:]?/, "").trim()
  return s.length > 62 ? s.slice(0, 62) + "..." : s
}

async function main() {
  const all = await getAllClauses()
  const demolition = all.filter((c) => c.profession === "demolition")
  console.log(`拆除爆破条款共 ${demolition.length} 条，开始导出...`)

  const lines: string[] = []
  lines.push("# 拆除爆破审核清单")
  lines.push("")
  lines.push("> 由 clause-db 锚点库自动导出。每条 = 一个审核检查点，含规范依据、审核要点、常见错误。")
  lines.push(`> 共 ${demolition.length} 条 = 人工拆除 4 + 机械拆除 4 + 爆破拆除 9 + 拆除通用 3。`)
  lines.push(`> 导出时间：${new Date().toLocaleString("zh-CN")}`)
  lines.push("")
  lines.push("**使用说明**：审核员对照方案，按本清单逐条核查。多专业调度（`getClausesByFeatures` 按 profession 过滤）保障——拆除、爆破方案下自动激活本库，并通过 `structure_type` 区分人工拆除、机械拆除和爆破拆除。")
  lines.push("")
  lines.push("**核心规范**：")
  lines.push("- **JGJ 147-2016**《建筑拆除工程安全技术规范》：人工拆除、机械拆除、爆破拆除和拆除通用安全要求。")
  lines.push("- **GB6722-2014**《爆破安全规程》：爆破安全允许距离、个别飞散物距离、盲炮处理。")
  lines.push("- **GA991-2012**《爆破作业项目管理要求》：爆破公告内容和发布时间。")
  lines.push("- **GA53-2015**《爆破作业人员资格条件和管理要求》：爆破员、安全员、保管员岗位分离。")
  lines.push("")
  lines.push("## 拆除爆破弹药库分层")
  lines.push("")
  lines.push("| 层级 | 适用对象 | 关键锚点 | 使用边界 |")
  lines.push("|------|----------|----------|----------|")
  lines.push("| 第一层：拆除通用原则 | 所有拆除工程 | JGJ 147-2016 3.0.6、3.0.7、6.0.3 | 先断水电气、禁止立体交叉作业、书面安全技术交底。 |")
  lines.push("| 第二层：人工/机械拆除 | 人工拆除、机械拆除、人工配合机械拆除 | JGJ 147-2016 5.1.1、5.1.2、5.1.3、5.2.2、5.2.3、5.2.9 | 审拆除顺序、作业面隔离、水平构件堆载、机械高度、人机同面。 |")
  lines.push("| 第三层：爆破拆除专用 | 建筑物、构筑物爆破拆除 | JGJ 147-2016 5.3.4、5.3.7、5.3.9；GB6722-2014 13.1.1、13.6.1、6.9.1 | 审安全距离、防护覆盖、警戒范围、盲炮处理、公告和爆破作业人员岗位。 |")
  lines.push("")

  let idx = 0
  for (const group of GROUPS) {
    const clauses = demolition.filter(group.filter)
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
      const ref = formatClauseReference(c)
      const point = firstSentence(c.audit_points).replace(/\|/g, "/")
      const err = (COMMON_ERROR_OVERRIDES[key] || extractCommonError(c.audit_points) || "—").replace(/\|/g, "/")
      lines.push(`| ${idx} | ${item} | ${ref} | ${point} | ${err} |`)
    }
    lines.push("")
  }

  lines.push("## 附录：高频易错点（拆除爆破审核优先核查）")
  lines.push("")
  lines.push("| 类型 | 易错点 | 规范值 | 错误写法 | 后果 |")
  lines.push("|------|--------|--------|----------|------|")
  lines.push("| 通用 | 拆除基本顺序 | 先断水电气，再拆设备管线，主体先非承重后承重（JGJ 147 第3.0.6条） | 未断电断气即拆除，或先拆承重结构 | 触电、燃爆、结构突坍 |")
  lines.push("| 通用 | 立体交叉作业 | 拆除工程不得立体交叉作业（JGJ 147 第3.0.7条） | 上下层同步拆除 | 坠物打击、连锁坍塌 |")
  lines.push("| 人工拆除 | 拆除顺序 | 自上而下逐层、分段；框架按楼板、次梁、主梁、结构柱（JGJ 147 第5.1.1条） | 从下部掏拆或多层同步拆 | 结构失稳坍塌 |")
  lines.push("| 人工拆除 | 水平构件堆载 | 水平构件严禁人员聚集或集中堆料（JGJ 147 第5.1.2条） | 楼板集中堆放拆除废料 | 楼板超载坍塌 |")
  lines.push("| 人工拆除 | 墙体拆除 | 严禁底部掏掘或推倒（JGJ 147 第5.1.3条） | 底部掏墙、牵引推墙 | 墙体失控倒塌 |")
  lines.push("| 机械拆除 | 拆除顺序 | 自上而下逐层、分段，先非承重后承重（JGJ 147 第5.2.2条） | 先拆柱、墙等承重构件 | 整体失稳 |")
  lines.push("| 机械拆除 | 机械作业高度 | 机械前端工作装置作业高度应超过拟拆除物高度（JGJ 147 第5.2.3条） | 短臂机械强拆高层构件 | 机械倾覆、构件失控 |")
  lines.push("| 机械拆除 | 双机起吊 | 每台载荷≤允许载荷80%，第一吊试吊，两机同步（JGJ 147 第5.2.6条） | 无计算书、无试吊、两机不同步 | 吊装失稳 |")
  lines.push("| 机械拆除 | 人机同面 | 人员与机械不得在同一作业面同时作业（JGJ 147 第5.2.9条） | 人工清理与机械破拆同面进行 | 机械伤害 |")
  lines.push("| 爆破拆除 | 安全允许距离 | 振动、冲击波、飞散物分别核定并取最大值（GB6722 第13.1.1条） | 只给一个经验警戒距离 | 人员或周边保护对象受损 |")
  lines.push("| 爆破拆除 | 飞散物距离 | 一般工程爆破个别飞散物对人员距离不小于表10要求（GB6722 第13.6.1条） | 警戒半径小于规范值 | 飞石伤人 |")
  lines.push("| 爆破拆除 | 防护覆盖 | 按设计防护覆盖，起爆前现场负责人检查验收（JGJ 147 第5.3.7条） | 防护材料、固定、验收缺失 | 飞散物失控 |")
  lines.push("| 爆破拆除 | 盲炮处理 | 严禁强行拉出药包和雷管（GB6722 第6.9.1.5条） | 强拉药包或雷管 | 爆炸伤亡 |")
  lines.push("| 爆破拆除 | 爆破公告 | 爆破前1天公告，含地点、时间、警戒范围、标志、起爆信号（GA991 第5.2.2.1条） | 公告时间不足或内容缺项 | 警戒失效 |")
  lines.push("| 爆破拆除 | 三岗分离 | 爆破员、安全员和保管员不得兼任（GA53 第7.1.3条） | 一人兼任爆破员和安全员 | 管控失效 |")
  lines.push("")
  lines.push("> 拆除爆破审核优先级：先判断拆除方式，再审顺序和隔离。人工拆除重点看自上而下、禁止掏掘推倒；机械拆除重点看机械作业高度、人机隔离和双机起吊；爆破拆除重点看安全距离、防护覆盖、盲炮处理和人员岗位。")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("**导出自**：`lib/clause-db.ts` SEED_CLAUSES（profession=demolition）。改种子后重跑 `npx tsx scripts/export-demolition-checklist.ts` 即可刷新本清单。")

  const outPath = path.join(process.cwd(), "docs", "拆除爆破审核清单.md")
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8")
  console.log(`已导出：${outPath}`)
  console.log(`   共 ${idx} 条审核项 + 高频易错点附录（15 条）`)
}

main().catch((error) => {
  console.error("导出失败:", error)
  process.exit(1)
})
