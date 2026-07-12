// scripts/check-architecture-boundaries.ts
// 验证核心业务已从大文件拆出清晰边界。
// 运行：npx tsx scripts/check-architecture-boundaries.ts

import fs from "fs"
import path from "path"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✅ ${message}`)
  }
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relativePath))
}

async function assertExports(relativePath: string, exportNames: string[]): Promise<void> {
  const mod = await import(path.join(process.cwd(), relativePath))
  for (const exportName of exportNames) {
    assert(exportName in mod, `${relativePath} 导出 ${exportName}`)
  }
}

async function main() {
  const expectedFiles = [
    "lib/review/review-types.ts",
    "lib/review/review-pipeline.ts",
    "lib/review/chunk-reviewer.ts",
    "lib/review/report-merger.ts",
    "lib/review/progress-stream.ts",
    "lib/review/model-clients.ts",
    "lib/review/context-budget.ts",
    "lib/review/report-summary.ts",
    "lib/review/stage-reviewer.ts",
    "lib/prompts/review-prompts.ts",
    "lib/professions/profession-types.ts",
    "lib/professions/profession-config.ts",
    "lib/professions/profession-matchers.ts",
    "lib/knowledge/knowledge-loader.ts",
    "lib/knowledge/knowledge-context.ts",
    "lib/knowledge/chunking.ts",
    "lib/clauses/clause-types.ts",
    "lib/clauses/clause-reference.ts",
    "lib/clauses/clause-repository.ts",
    "lib/clauses/clause-search.ts",
    "lib/storage/review-repository.ts",
    "lib/storage/sqlite-review-repository.ts",
    "lib/storage/supabase-review-repository.ts",
    "lib/storage/review-repository-factory.ts",
  ]

  for (const relativePath of expectedFiles) {
    assert(fileExists(relativePath), `存在边界模块 ${relativePath}`)
  }

  await assertExports("lib/review/review-pipeline.ts", ["runReviewPipeline"])
  await assertExports("lib/review/context-budget.ts", ["estimateTokens", "planReviewContext", "REVIEW_CONTEXT_LIMITS"])
  await assertExports("lib/review/stage-reviewer.ts", [
    "runCompletenessReviewStage",
    "runTechnicalReviewStage",
    "mergeStageReports",
  ])
  await assertExports("lib/prompts/review-prompts.ts", [
    "buildReviewPrompt",
    "buildCompletenessReviewPrompt",
    "buildTechnicalReviewPrompt",
    "buildStageMergePrompt",
    "buildChunkReviewPrompt",
    "buildMergePrompt",
    "formatAnchorClauses",
    "REVIEW_SYSTEM_PROMPT",
  ])
  await assertExports("lib/professions/profession-config.ts", ["PROFESSION_TYPES"])
  await assertExports("lib/professions/profession-matchers.ts", ["identifyProfessionTypes", "identifySchemeFeatures"])
  await assertExports("lib/knowledge/knowledge-context.ts", ["extractKnowledgeContext", "getKnowledgeBaseInfo"])
  await assertExports("lib/knowledge/chunking.ts", ["shouldUseChunkedReview", "splitDocumentBySections"])
  await assertExports("lib/clauses/clause-search.ts", ["getClausesByFeatures", "getAllClauses"])
  await assertExports("lib/clauses/clause-reference.ts", ["formatClauseReference", "formatClauseNumber", "formatStandardName"])
  await assertExports("lib/storage/review-repository-factory.ts", ["saveReviewWithFallback"])

  const route = fs.readFileSync(path.join(process.cwd(), "app/api/review/route.ts"), "utf-8")
  assert(route.includes("runReviewPipeline"), "API route 通过 runReviewPipeline 调用审核流程")
  assert(!route.includes("function buildReviewPrompt"), "API route 不再内联 buildReviewPrompt")
  assert(!route.includes("function buildMergePrompt"), "API route 不再内联 buildMergePrompt")
  assert(!route.includes("CHUNK_REVIEW_PROMPT_TEMPLATE"), "API route 不再内联分块 prompt 模板")

  const apiFiles = [
    "app/api/review/route.ts",
    "app/api/history/route.ts",
    "app/api/history/[id]/route.ts",
    "app/api/professions/route.ts",
  ]
  for (const apiFile of apiFiles) {
    const source = fs.readFileSync(path.join(process.cwd(), apiFile), "utf-8")
    assert(!source.includes("@/lib/db"), `${apiFile} 不直接依赖 lib/db 存储实现`)
  }

  const pipeline = fs.readFileSync(path.join(process.cwd(), "lib/review/review-pipeline.ts"), "utf-8")
  assert(!pipeline.includes("@/lib/knowledge-base"), "review pipeline 不直接依赖旧 knowledge-base 大入口")
  assert(pipeline.includes("@/lib/knowledge/knowledge-context"), "review pipeline 通过 knowledge-context 获取审核上下文")
  assert(pipeline.includes("@/lib/professions/profession-matchers"), "review pipeline 通过 profession-matchers 做专业识别")
  assert(pipeline.includes("@/lib/clauses/clause-search"), "review pipeline 通过 clause-search 查询条款")
  assert(pipeline.includes("@/lib/storage/review-repository-factory"), "review pipeline 通过 repository factory 保存记录")

  if (process.exitCode) {
    console.error("\n❌ 架构边界验证未通过")
    process.exit(process.exitCode)
  }

  console.log("\n✅ 架构边界验证通过")
}

main().catch((error) => {
  console.error("验证失败:", error)
  process.exit(1)
})
