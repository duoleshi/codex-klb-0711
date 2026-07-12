import type { MatchedClause } from "@/lib/clauses/clause-types"
import { formatClauseReference } from "@/lib/clauses/clause-reference"

export const REVIEW_SYSTEM_PROMPT = `你是一位专业的施工方案审核专家。你的任务是：
1. 严格按照提供的知识库内容进行审核
2. 使用表格化格式输出审核报告
3. 每个问题都要给出具体依据和整改建议
4. 对于缺失内容要明确标注
5. 保持专业、客观的审核风格
 6. 用户上传的方案正文已经包含在 prompt 的“待审核内容”中，不得回复“请提供方案全文”或把审核报告写成示例
7. 直接从报告标题开始输出，不得输出“好的、收到指令、我将严格按照”等寒暄或过程说明`

export const MERGE_SYSTEM_PROMPT = "你是一位专业的施工方案审核专家，请将多份分块审核报告合并成一份完整、专业的审核报告。最终回答必须直接从报告标题开始，不得输出寒暄、确认指令或过程说明。"

export const COMPLETENESS_CHECK_ITEMS = [
  "工程及周边环境描述",
  "施工总平面布置图",
  "相关施工图纸",
  "资源配置计划",
  "施工进度计划",
  "施工设计计算书",
  "风险辨识与分级管控",
  "施工工艺技术",
  "关键工序检验与验收要求",
  "应急处置措施",
  "毗邻建筑、道路、地下管线专项防护",
  "临时用电安全技术措施",
  "监测监控措施",
  "人员配备、职责、特种作业持证",
  "验收要求",
]

function clausePriority(c: MatchedClause): number {
  if (c.standard_code === "建办质〔2024〕63号") return 0
  if (c.standard_code === "建办质〔2021〕48号") return 1
  if (c.profession === "general") return 2
  return 3
}

function sortClausesForAttention(clauses: MatchedClause[]): MatchedClause[] {
  return [...clauses].sort((a, b) => {
    const priorityDiff = clausePriority(a) - clausePriority(b)
    if (priorityDiff !== 0) return priorityDiff
    return b.priority - a.priority || a.standard_code.localeCompare(b.standard_code) || a.clause_no.localeCompare(b.clause_no)
  })
}

export function formatAnchorClauses(clauses: MatchedClause[]): string {
  if (clauses.length === 0) return ""

  const sorted = sortClausesForAttention(clauses)
  const general = sorted.filter((c) => c.profession === "general")
  const profession = sorted.filter((c) => c.profession !== "general")
  const render = (c: MatchedClause, strong: boolean) => {
    const prefix = strong ? "【强标·必审】" : ""
    return (
      `${prefix}${formatClauseReference(c)} ${c.clause_title}\n` +
      `原文：${c.clause_text}\n` +
      `审核要点：${c.audit_points ?? ""}` +
      (c.matchedBy?.length ? `\n（匹配依据：${c.matchedBy.join("、")}）` : "")
    )
  }

  const parts: string[] = []
  if (general.length) {
    parts.push("══ 强标·必审（跨专业强制性条款，无论方案属何专业都必查，须优先逐条核对）══")
    parts.push(general.map((c) => render(c, true)).join("\n\n"))
  }
  if (profession.length) {
    parts.push("══ 专业/构造专属条款（已按方案特征过滤，仅含本方案相关）══")
    parts.push(profession.map((c) => render(c, false)).join("\n\n"))
  }

  return parts.join("\n\n")
}

function auditClassificationBlock(): string {
  return `# 分类标准（归章依据）

- **完整性缺失优先判定**：专项施工方案缺少施工图纸、资源计划、进度计划、计算书、风险辨识、验收要求、应急处置、临时用电、毗邻防护、监测监控等必备内容时，必须先列入完整性审核；达到严重缺陷或强制性条文违反的，归入致命缺陷。
- **致命缺陷**（一票否决·会导致安全事故或结构失稳）：材料规格严重不符、设计计算错误或缺失、高大模板监测方案缺失或报警值/频率/点距严重违规、关键构造（连墙件/剪刀撑/扫地杆）完全缺失、应急预案无法响应、违反强制性条文。
- **技术问题**（参数错误·不符合专用技术规范）：参数数值不符、构造做法不符专用规范、脚手架体系规范引用错误。
- **管理问题**（编制缺项·内容不完整·表述不规范）：章节缺失、内容不完整、表述模糊不规范、资质与制度类。

每条意见按问题性质归入唯一章节，**同一问题只在一个章节出现**，不得跨章重复。**条款原文必须逐字复制锚点库原文，严禁概括、改写或合并条款编号**。`
}

function issueFormatContractBlock(): string {
  return `# 审核意见 Markdown 格式契约（必须逐字遵守）

每一条“缺陷/意见”只能使用以下四要素模板。字段名称必须和加粗符号在同一行闭合，不得拆行：

**缺陷1：问题标题**

- **【问题描述】** 写清问题事实、风险后果和严重性。
- **【方案对应内容】** 写明方案章节、页码、表格、附件或“无”。
- **【依据】**
  - 规范名称：《规范或文件全称》
  - 条款编号：第X.X.X条
  - 条款原文：“必须完整复制锚点库原文，不得改写。”
- **【整改要求/建议】** 写清必须补充、修改、复核或重新计算的具体动作。

格式禁令：
- 禁止输出孤立的 \`- **\`。
- 禁止输出 \`【问题描述】**\`、\`【方案对应内容】**\`、\`【依据】**\`、\`【整改要求/建议】**\`。
- 禁止把字段写成普通段落；四要素必须用 \`- **【字段名】** 内容\` 形式输出。
- 一个字段写完后，不得额外补一行空的加粗符号。`
}

function completenessChecklistBlock(): string {
  return `# 完整性审核清单（必须先审完整性）

你必须先完成方案完整性审核，不得跳过完整性审核，不得先输出技术参数问题。逐项核查以下内容是否在待审核方案中真实存在、是否具体可执行：

${COMPLETENESS_CHECK_ITEMS.map((item, index) => `${index + 1}. ${item}`).join("\n")}

判定规则：
- 方案完全没有该项内容：写“缺失”，达到严重缺陷清单或强制条文要求的，列入致命缺陷。
- 方案只有标题或空泛表述、没有本工程参数/图表/责任/流程：写“不完整”，按管理问题或致命缺陷归类。
- 方案已提供且内容具体：写“已提供”，无需强行挑刺。
- 确与本工程无关：写“不适用”，并说明依据。`
}

function fullReportFormat(filename: string, professionNames: string, anchorCount: string, extraInfo = ""): string {
  return `# ${filename}方案审核报告

## 1. 基本信息

**工程名称：** ${filename}

**专业类型：** ${professionNames}

**危大工程判定：** 根据方案内容判断是否危大工程（危险性较大工程、超过一定规模的危险性较大工程、一般专项方案）。

**审核依据：** 共匹配 ${anchorCount} 条精准锚点条款（含强标通用，详见各段引用）
${extraInfo}

## 2. 审核摘要

**审核结论：** 【通过 / 不通过（存在致命缺陷 N 项）】

**主要问题概览：** （列出最关键的 2-3 条）

**核心整改方向：** （一句话总结整改方向）

## 3. 完整性必审项核查

必须先输出下表。不得省略；不得只写摘要。

| 序号 | 必审项 | 核查结论（已提供/缺失/不完整/不适用） | 问题等级 | 方案对应内容 |
|------|--------|--------------------------------------|----------|--------------|
| 1 | 工程及周边环境描述 | | | |
| 2 | 施工总平面布置图 | | | |
| 3 | 相关施工图纸 | | | |
| 4 | 资源配置计划 | | | |
| 5 | 施工进度计划 | | | |
| 6 | 施工设计计算书 | | | |
| 7 | 风险辨识与分级管控 | | | |
| 8 | 应急处置措施 | | | |
| 9 | 毗邻建筑、道路、地下管线专项防护 | | | |
| 10 | 临时用电安全技术措施 | | | |
| 11 | 监测监控措施 | | | |
| 12 | 验收要求 | | | |

## 4. 致命缺陷审核

> 输出致命缺陷前，必须先完成完整性必审项判断；缺少施工图纸、计算书、资源计划、进度计划、应急、临电、毗邻防护、验收、监测等内容时，应优先列入本章或管理问题章，不得只审技术参数。

（一票否决项：会导致安全事故或结构失稳的问题。若确无致命缺陷，明确写"本方案未发现致命缺陷"。）

**缺陷1：**

- **【问题描述】** （填写问题事实、风险后果和严重性）
- **【方案对应内容】** （填写方案章节、页码、表格、附件或“无”）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改动作）

## 5. 技术问题审核

**意见1：**

- **【问题描述】** （填写问题事实、风险后果和严重性）
- **【方案对应内容】** （填写方案章节、页码、表格、附件或“无”）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改动作）

## 6. 管理问题审核

**意见1：**

- **【问题描述】** （填写问题事实、风险后果和严重性）
- **【方案对应内容】** （填写方案章节、页码、表格、附件或“无”）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改动作）

## 7. 审核人员

| 角色 | 签字 | 日期 |
|------|------|------|
| 专业监理工程师 | | |
| 总监理工程师 | | |`
}

function strictRulesBlock(): string {
  return `# 强制要求

1. 严格依据提供的锚点条款审核，不得引用锚点库以外的规范文件或标准。
2. 每条审核意见必须包含完整四要素：问题描述、方案对应内容、依据（规范名称+条款编号+条款原文）、整改要求/建议。
3. 整改建议必须具体可执行，不得使用"建议完善"、"建议补充"等模糊表述。
4. **意见独立性**：不得输出问题描述/依据/整改完全相同或高度相似的两条意见。
5. **审核判断逻辑**：方案参数严于或等于规范值时不得挑刺；低于或违反规范值时须明确整改。
6. **完整性优先**：必须先审完整性，再审技术细节；不得因为发现技术参数问题而遗漏方案缺项。
7. 【禁止事项】：禁止编造规范名称、编号、条款号；禁止修改条款原文；禁止概括、改写或合并条款编号；库内无确切依据则不提该问题。
8. 【禁止事项】：不得回复“请提供方案全文”“以下为示例性审核”等话术；待审核内容已经提供，必须直接审核。
9. 【格式要求】：必须遵守“审核意见 Markdown 格式契约”，不得输出孤立的 \`- **\` 或 \`【字段名】**\` 这种坏格式。
10. 【展示要求】：最终报告第一行必须是 \`# 文件名方案审核报告\`；不得输出“好的、收到指令、我将”等前言；不得用独立的 \`---\` 分隔章节。`
}

export function buildReviewPrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  anchorCount: string,
  anchorClausesText: string,
  documentContent: string
): string {
  return `# 角色定位

你是一位经验丰富的施工方案审核专家，精通建筑施工规范。请根据用户上传的施工方案，对照提供的精准条款锚点进行专业审核。

# 审核依据（精准条款锚点 —— 本次审核的唯一依据）

以下条款由代码按本方案的专业类型、构造体系、涉及材料与工艺从规范中精准提取。标注 **【强标·必审】** 的为跨专业强制性条款，其余为本方案专业/构造专属条款。

审核要求：
1. **逐条对照**：每条判断方案是否符合，并在报告里完整复制条款原文。
2. **严禁越界引用**：除以下条款外，不得引用其他规范条款。
3. 方案违反任一条均须出具审核意见。

---
${anchorClausesText || "（本方案类型暂未配置锚点条款，按通用要求审核）"}
---

# 审核顺序（必须执行）

1. 先审完整性：按“完整性审核清单”逐项查缺项，先发现图纸、计划、计算书、应急、临电、毗邻防护、验收、监测等缺失或不完整问题。
2. 再审技术细节：在完整性审核完成后，再检查材料规格、构造措施、参数取值、计算逻辑。
3. 最后审管理表达：检查职责、流程、表述、计划细化程度和可执行性。

${completenessChecklistBlock()}

# 待审核内容
---
${documentContent}
---

# 审核输出格式（必须严格遵守以下格式）

${auditClassificationBlock()}

${issueFormatContractBlock()}

${fullReportFormat(filename, professionNames, anchorCount, `\n\n**审核时间：** ${currentDate}`)}

${strictRulesBlock()}`
}

export function buildCompletenessReviewPrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  anchorCount: string,
  anchorClausesText: string,
  documentContent: string
): string {
  return `# 任务

你是一位施工方案审核专家。请对《${filename}》先审完整性，输出“完整性阶段审核报告”。这是第一阶段，目标是发现方案是否缺少必备章节、图纸、计划、计算书、应急、临电、毗邻防护、验收和监测等内容。

**重要约束：待审核方案正文已经在下方提供，不得要求用户重新提供文本，不得输出示例性审核。**

# 基本信息

- 专业类型：${professionNames}
- 审核日期：${currentDate}
- 匹配锚点：${anchorCount} 条

# 完整性审核依据（优先使用严重缺陷清单、编制指南、强制性通用条款）
---
${anchorClausesText || "（无完整性锚点）"}
---

${completenessChecklistBlock()}

# 待审核内容
---
${documentContent}
---

# 输出要求

1. 只输出完整性阶段审核报告，不输出最终完整报告。
2. 必须先给出“完整性必审项核查表”，表头为：序号｜必审项｜核查结论（已提供/缺失/不完整/不适用）｜问题等级｜方案对应内容。
3. 对“缺失”或“不完整”的项目，继续输出审核意见，必须包含问题描述、方案对应内容、依据、整改要求/建议。
4. 图纸、计算书、资源计划、进度计划、风险辨识、应急处置、临时用电、毗邻防护、监测监控、验收要求不得漏审。
5. 本阶段不要被立杆规格、斜杆布置等技术细节吸引；技术参数留到第二阶段。

${issueFormatContractBlock()}

${strictRulesBlock()}`
}

export function buildTechnicalReviewPrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  anchorCount: string,
  anchorClausesText: string,
  documentContent: string,
  completenessReport: string
): string {
  return `# 任务

你是一位施工方案审核专家。请在完整性阶段已完成的基础上，对《${filename}》进行第二阶段技术细节审核。

**重要约束：不得重复完整性阶段已经提出的缺项问题；除非技术参数直接导致结构失稳或违反强制性条文，否则不要把技术细节覆盖完整性缺失。**

# 基本信息

- 专业类型：${professionNames}
- 审核日期：${currentDate}
- 匹配锚点：${anchorCount} 条

# 第一阶段完整性审核结果（不得遗漏，第二阶段只补充技术问题）
---
${completenessReport}
---

# 技术审核依据（专业/构造专属条款）
---
${anchorClausesText || "（无专业技术锚点）"}
---

# 待审核内容
---
${documentContent}
---

# 输出要求

1. 只输出技术阶段审核报告，不输出最终完整报告。
2. 重点审核材料规格、构造措施、支撑体系参数、计算取值、验算逻辑、监测参数、专项工艺要求。
3. 对每条问题必须写明方案对应内容、依据条款原文和具体整改要求。
4. 不得引用锚点库以外条款；不得编造条款。

${issueFormatContractBlock()}

${strictRulesBlock()}`
}

export function buildStageMergePrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  anchorCount: string,
  completenessReport: string,
  technicalReport: string,
  anchorClausesText: string
): string {
  return `# 任务

你是一位施工方案审核专家。现在需要将“完整性阶段审核报告”和“技术阶段审核报告”合并为最终施工方案审核报告。

# 完整性阶段审核报告（优先保留，缺项不得遗漏）
---
${completenessReport}
---

# 技术阶段审核报告（补充技术参数、构造、计算问题）
---
${technicalReport}
---

# 精准条款锚点（最终报告引用必须与下方一致）
---
${anchorClausesText || "（无锚点）"}
---

# 合并要求

1. 完整性问题优先保留：图纸、计划、计算书、资源、应急、临电、毗邻防护、验收、监测等缺失不得在合并时丢失。
2. 去重：同一问题只保留一次；同一问题既可归为完整性缺失又可归为管理问题时，按严重程度放入最高级别章节。
3. 排序：先列致命缺陷中的完整性缺失和强制性条文违反，再列技术问题，最后列管理问题。
4. 不得新增两个阶段报告中没有依据支撑的问题；不得引用锚点库以外条款。
5. 不得输出“请提供方案全文”“示例性审核”等话术。

${auditClassificationBlock()}

${issueFormatContractBlock()}

${fullReportFormat(filename, professionNames, anchorCount, `\n\n**审核时间：** ${currentDate}`)}

${strictRulesBlock()}`
}

export function buildChunkReviewPrompt(chapterTitle: string, anchorClausesText: string, documentContent: string): string {
  return `# 角色定位

你是一位施工方案审核专家。请对以下文档片段进行审核。

# 本片段精准条款锚点（必须优先逐条核对，违反任一条须出具意见）
---
${anchorClausesText}
---

# 待审核内容 - ${chapterTitle}
---
${documentContent}
---

# 审核要求

1. 仅就本片段**实际看到的内容**出具审核意见。若本片段未涉及某主题，不得下"方案未提及/未明确"结论。
2. 输出格式：每条意见必须标注【致命】、【技术】或【管理】，并包含问题描述、方案对应内容、依据、整改要求/建议。
3. 如果本片段内容完整、符合规范，请直接说明"本片段内容符合规范要求"。
4. 不要输出整体报告格式，只输出针对本片段的审核意见。
5. 条款原文必须逐字复制锚点库原文，不得引用锚点库以外的规范；库内无确切依据则不提该问题。

${issueFormatContractBlock()}`
}

export function buildMergePrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  chunkCount: string,
  anchorCount: string,
  chunkReports: string,
  anchorClausesText?: string
): string {
  return `# 任务

你是一位施工方案审核专家。现在需要将以下多份分块审核报告合并成一份完整、专业的审核报告。

# 分块审核报告
---
${chunkReports}
---

# 精准条款锚点（汇总时必须保留这些条款的核对意见，不得遗漏；引用条款号与原文必须与下方一致）
---
${anchorClausesText || "（无锚点）"}
---

# 合并要求

1. **去重与调和**：合并相同或相似的审核意见。若同一主题同时出现"参数错/有方案原文"和"未提及/未明确"，以有具体内容的描述为准。
2. **归类与跨章去重**：每条意见按问题性质归入唯一章节。同一规范条款只在最高级别章节出现一次。
3. **条款原文逐字复制**：必须完整复制锚点库原文，严禁概括、改写或合并条款编号；库内无确切依据则不提该问题。

${auditClassificationBlock()}

${issueFormatContractBlock()}

${fullReportFormat(filename, professionNames, anchorCount, `\n\n分块审核共 ${chunkCount} 个块\n\n**审核时间：** ${currentDate}`)}

${strictRulesBlock()}`
}
