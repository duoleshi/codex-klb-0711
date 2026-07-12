// scripts/check-completeness-first-review.ts
// 验证审核流程是否强制执行“完整性优先”：先审方案缺项，再审技术参数。
// 运行：npx tsx scripts/check-completeness-first-review.ts

import fs from "fs"
import path from "path"
import { getAllClauses } from "../lib/clauses/clause-search"
import * as reviewPrompts from "../lib/prompts/review-prompts"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✅ ${message}`)
  }
}

function indexOfOrInfinity(text: string, pattern: string): number {
  const index = text.indexOf(pattern)
  return index === -1 ? Number.POSITIVE_INFINITY : index
}

async function main() {
  const promptExports = reviewPrompts as Record<string, unknown>
  assert(typeof promptExports.buildCompletenessReviewPrompt === "function", "存在完整性审核阶段 prompt")
  assert(typeof promptExports.buildTechnicalReviewPrompt === "function", "存在技术细节审核阶段 prompt")
  assert(typeof promptExports.buildStageMergePrompt === "function", "存在阶段报告汇总 prompt")

  const clauses = await getAllClauses()
  const renderedAnchors = reviewPrompts.formatAnchorClauses(clauses.map((c) => ({ ...c, matchedBy: ["检查"] })))
  const seriousIndex = indexOfOrInfinity(renderedAnchors, "危险性较大的分部分项工程专项施工方案严重缺陷清单")
  const guideIndex = indexOfOrInfinity(renderedAnchors, "危险性较大的分部分项工程专项施工方案编制指南")
  const technicalIndex = indexOfOrInfinity(renderedAnchors, "建筑施工承插型盘扣式钢管脚手架安全技术标准")
  assert(seriousIndex < technicalIndex, "严重缺陷清单锚点排在专业技术锚点前")
  assert(guideIndex < technicalIndex, "编制指南锚点排在专业技术锚点前")

  const buildCompletenessReviewPrompt = promptExports.buildCompletenessReviewPrompt as
    | ((...args: string[]) => string)
    | undefined
  const completenessPrompt = buildCompletenessReviewPrompt?.(
    "清华附中高大模板.pdf",
    "模板支撑体系工程",
    "2026年7月11日",
    "106",
    renderedAnchors,
    "本方案为高大模板专项施工方案，采用盘扣式支撑架。"
  ) ?? ""

  const requiredItems = [
    "施工总平面布置图",
    "相关施工图纸",
    "资源配置计划",
    "施工进度计划",
    "施工设计计算书",
    "应急处置措施",
    "毗邻建筑、道路、地下管线专项防护",
    "临时用电安全技术措施",
    "风险辨识与分级管控",
    "验收要求",
  ]
  for (const item of requiredItems) {
    assert(completenessPrompt.includes(item), `完整性 prompt 固化必审项：${item}`)
  }
  assert(completenessPrompt.includes("先审完整性"), "完整性 prompt 明确先审完整性")
  assert(completenessPrompt.includes("不得跳过完整性审核"), "完整性 prompt 禁止跳过完整性审核")

  const buildStageMergePrompt = promptExports.buildStageMergePrompt as
    | ((...args: string[]) => string)
    | undefined
  const mergePrompt = buildStageMergePrompt?.(
    "清华附中高大模板.pdf",
    "模板支撑体系工程",
    "2026年7月11日",
    "106",
    "完整性阶段报告",
    "技术阶段报告",
    renderedAnchors
  ) ?? ""
  assert(mergePrompt.includes("## 3. 完整性必审项核查"), "最终报告模板包含完整性必审项核查章节")
  assert(mergePrompt.includes("核查结论（已提供/缺失/不完整/不适用）"), "最终报告模板固定完整性核查表")

  const pipelineSource = fs.readFileSync(path.join(process.cwd(), "lib/review/review-pipeline.ts"), "utf8")
  assert(pipelineSource.includes("runCompletenessReviewStage"), "主审核 pipeline 调用完整性审核阶段")
  assert(pipelineSource.includes("runTechnicalReviewStage"), "主审核 pipeline 调用技术审核阶段")
  assert(pipelineSource.includes("mergeStageReports"), "主审核 pipeline 汇总完整性与技术阶段报告")

  if (process.exitCode) {
    console.error("\n❌ 完整性优先审核检查未通过")
    process.exit(process.exitCode)
  }

  console.log("\n✅ 完整性优先审核检查通过")
}

main().catch((error) => {
  console.error("检查失败:", error)
  process.exit(1)
})
