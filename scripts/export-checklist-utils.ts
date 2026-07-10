import { getAllClauses, type Clause } from "../lib/clause-db"
import fs from "fs"
import path from "path"

export type ChecklistGroup = {
  title: string
  subtitle: string
  structureType: string | null
}

export type ChecklistConfig = {
  profession: string
  name: string
  outputFile: string
  summary: string
  sourceNote: string
  coreStandards: string[]
  layers: { level: string; scope: string; anchors: string; boundary: string }[]
  groups: ChecklistGroup[]
  highRiskRows: string[]
  priorityNote: string
}

function firstSentence(ap: string | null): string {
  if (!ap) return ""
  const s = ap.split(/。[。]/)[0].replace(/^核对[：:]?/, "").trim()
  return s.length > 64 ? s.slice(0, 64) + "..." : s
}

function extractCommonError(ap: string | null): string {
  if (!ap) return "—"
  const patterns = [
    /方案[^，。；]*?(即不符合|即不合规|即违规|不符合|不合规|违规)/,
    /严禁[^，。；]*?[，。；]/,
    /不得[^，。；]*?[，。；]/,
    /必须[^，。；]*?[，。；]/,
    /缺[^，。；]*?(即不符合|即不合规|不符合|不合规)/,
  ]
  for (const pattern of patterns) {
    const match = ap.match(pattern)
    if (match) {
      return match[0]
        .replace(/(即不符合|即不合规|即违规|不符合|不合规|违规)[，。；]?$/, "")
        .replace(/[，。；]$/, "")
    }
  }
  return "—"
}

function renderTableRows(clauses: Clause[], startIndex: number): { rows: string[]; nextIndex: number } {
  let idx = startIndex
  const rows: string[] = []
  for (const c of clauses) {
    idx++
    const item = c.clause_title.replace(/\|/g, "/")
    const ref = `${c.standard_code} 第${c.clause_no}条`
    const point = firstSentence(c.audit_points).replace(/\|/g, "/")
    const err = extractCommonError(c.audit_points).replace(/\|/g, "/")
    rows.push(`| ${idx} | ${item} | ${ref} | ${point} | ${err} |`)
  }
  return { rows, nextIndex: idx }
}

export async function exportChecklist(config: ChecklistConfig) {
  const all = await getAllClauses()
  const clauses = all.filter((c) => c.profession === config.profession)
  console.log(`${config.name}条款共 ${clauses.length} 条，开始导出...`)

  const lines: string[] = []
  lines.push(`# ${config.name}审核清单`)
  lines.push("")
  lines.push("> 由 clause-db 锚点库自动导出。每条 = 一个审核检查点，含规范依据、审核要点、常见错误。")
  lines.push(`> ${config.summary}`)
  lines.push(`> 导出时间：${new Date().toLocaleString("zh-CN")}`)
  lines.push("")
  lines.push("**使用说明**：审核员对照方案，按本清单逐条核查。多专业调度（`getClausesByFeatures` 按 profession 过滤）保障本专业方案下自动激活对应条款，并通过 `structure_type` 区分构造或工法，避免跨专业误引规范。")
  lines.push("")
  lines.push(`**依据来源目录**：${config.sourceNote}`)
  lines.push("")
  lines.push("**核心规范**：")
  for (const standard of config.coreStandards) {
    lines.push(`- ${standard}`)
  }
  lines.push("")
  lines.push(`## ${config.name}弹药库分层`)
  lines.push("")
  lines.push("| 层级 | 适用对象 | 关键锚点 | 使用边界 |")
  lines.push("|------|----------|----------|----------|")
  for (const layer of config.layers) {
    lines.push(`| ${layer.level} | ${layer.scope} | ${layer.anchors} | ${layer.boundary} |`)
  }
  lines.push("")

  let idx = 0
  for (const group of config.groups) {
    const groupClauses = clauses
      .filter((c) => (c.structure_type ?? null) === group.structureType)
      .sort((a, b) => b.priority - a.priority || a.clause_no.localeCompare(b.clause_no))
    if (groupClauses.length === 0) continue

    lines.push(`## ${group.title}`)
    lines.push(`**${group.subtitle}** — ${groupClauses.length} 条`)
    lines.push("")
    lines.push("| # | 审核项 | 规范条款 | 审核要点（精简） | 常见错误 |")
    lines.push("|---|--------|----------|------------------|----------|")
    const rendered = renderTableRows(groupClauses, idx)
    lines.push(...rendered.rows)
    idx = rendered.nextIndex
    lines.push("")
  }

  lines.push(`## 附录：高频易错点（${config.name}审核优先核查）`)
  lines.push("")
  lines.push("| 类型 | 易错点 | 审核控制值/要求 | 常见错误 | 后果 |")
  lines.push("|------|--------|------------------|----------|------|")
  lines.push(...config.highRiskRows)
  lines.push("")
  lines.push(`> ${config.priorityNote}`)
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push(`**导出自**：\`lib/clause-db.ts\` SEED_CLAUSES（profession=${config.profession}）。改种子后重跑 \`npx tsx scripts/${path.basename(process.argv[1] ?? "")}\` 即可刷新本清单。`)

  const outPath = path.join(process.cwd(), "docs", config.outputFile)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8")
  console.log(`已导出：${outPath}`)
  console.log(`   共 ${idx} 条审核项 + 高频易错点附录（${config.highRiskRows.length} 条）`)
}
