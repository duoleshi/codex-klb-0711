// scripts/check-report-markdown-format.ts
// 验证审核报告 Markdown 四要素格式约束，以及前后端坏格式清洗。
// 运行：npx tsx scripts/check-report-markdown-format.ts

import { normalizeReviewMarkdown } from "../lib/review/report-markdown"
import { buildCompletenessReviewPrompt, buildStageMergePrompt, buildTechnicalReviewPrompt } from "../lib/prompts/review-prompts"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✅ ${message}`)
  }
}

function main() {
  const malformed = `好的，收到指令。作为施工方案审核专家，我将严格按照您的要求输出最终报告。

# 清华附中高大模板.pdf方案审核报告

---

【问题描述】** 整个方案中完全没有提供任何施工设计计算书。
- **

【方案对应内容】** 第十一章“附件”（空白），水平间距20m~25m。
- **

【依据】**
  - 规范名称：《危险性较大的分部分项工程专项施工方案编制指南》
  - 条款编号：第（九）.1条
  - 条款原文：“施工设计计算书：含荷载条件、计算依据、计算参数、荷载工况组合、计算简图（模型）、控制指标及计算结果等。”
- **

【整改要求/建议】** 必须在附件中提供完整的施工设计计算书。`

  const normalized = normalizeReviewMarkdown(malformed)

  assert(normalized.startsWith("# 清华附中高大模板.pdf方案审核报告"), "清洗器移除报告标题前的寒暄前言")
  assert(!/^\s*-\s*\*\*\s*$/m.test(normalized), "清洗器移除孤立的 - ** 行")
  assert(!/^\s*-{3,}\s*$/m.test(normalized), "清洗器移除独立分隔横线")
  assert(!/^\s*-?\s*【(?:问题描述|方案对应内容|依据|整改要求\/建议)】\*\*/m.test(normalized), "清洗器移除字段后的坏加粗符号")
  assert(normalized.includes("- **【问题描述】** 整个方案中完全没有提供任何施工设计计算书。"), "问题描述字段恢复为合法 Markdown 列表")
  assert(normalized.includes("- **【方案对应内容】** 第十一章“附件”（空白），水平间距20m～25m。"), "方案对应内容字段恢复为合法 Markdown 列表并规范范围符号")
  assert(normalized.includes("- **【依据】**"), "依据字段恢复为合法 Markdown 列表")
  assert(normalized.includes("- **【整改要求/建议】** 必须在附件中提供完整的施工设计计算书。"), "整改建议字段恢复为合法 Markdown 列表")

  const promptArgs = [
    "清华附中高大模板.pdf",
    "模板支撑体系工程",
    "2026年7月11日",
    "106",
    "锚点条款",
    "待审核正文",
  ] as const
  const completenessPrompt = buildCompletenessReviewPrompt(...promptArgs)
  const technicalPrompt = buildTechnicalReviewPrompt(...promptArgs, "完整性阶段报告")
  const mergePrompt = buildStageMergePrompt(
    "清华附中高大模板.pdf",
    "模板支撑体系工程",
    "2026年7月11日",
    "106",
    "完整性阶段报告",
    "技术阶段报告",
    "锚点条款"
  )

  for (const [name, prompt] of [
    ["完整性阶段 prompt", completenessPrompt],
    ["技术阶段 prompt", technicalPrompt],
    ["合并阶段 prompt", mergePrompt],
  ] as const) {
    assert(prompt.includes("审核意见 Markdown 格式契约"), `${name} 包含 Markdown 格式契约`)
    assert(prompt.includes("禁止输出孤立的 `- **`"), `${name} 禁止孤立加粗列表`)
    assert(prompt.includes("不得输出“好的、收到指令、我将"), `${name} 禁止寒暄前言`)
    assert(prompt.includes("- **【问题描述】**"), `${name} 固化问题描述字段格式`)
    assert(prompt.includes("- **【整改要求/建议】**"), `${name} 固化整改建议字段格式`)
  }

  if (process.exitCode) {
    console.error("\n❌ 审核报告 Markdown 格式检查未通过")
    process.exit(process.exitCode)
  }

  console.log("\n✅ 审核报告 Markdown 格式检查通过")
}

main()
