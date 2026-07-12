import { parseUploadedFile, type ProgressCallback } from "@/lib/pdf-parser"
import { extractKnowledgeContext, getKnowledgeBaseInfo } from "@/lib/knowledge/knowledge-context"
import { splitDocumentBySections } from "@/lib/knowledge/chunking"
import { PROFESSION_TYPES, type ProfessionType } from "@/lib/professions/profession-config"
import { identifyProfessionTypes, identifySchemeFeatures } from "@/lib/professions/profession-matchers"
import { getClausesByFeatures } from "@/lib/clauses/clause-search"
import type { MatchedClause } from "@/lib/clauses/clause-types"
import { formatAnchorClauses } from "@/lib/prompts/review-prompts"
import { saveReviewWithFallback } from "@/lib/storage/review-repository-factory"
import { planReviewContext, REVIEW_CONTEXT_LIMITS } from "./context-budget"
import { getModelConfig } from "./model-clients"
import { reviewDocumentChunks } from "./chunk-reviewer"
import { mergeChunkReports } from "./report-merger"
import { extractConclusion } from "./report-summary"
import { mergeStageReports, runCompletenessReviewStage, runTechnicalReviewStage } from "./stage-reviewer"
import type { RunReviewPipelineInput } from "./review-types"

function currentChineseDate(): string {
  return new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function professionNamesFromTypes(professionTypes: { name: string }[]): string {
  return professionTypes.length > 0 ? professionTypes.map((p) => p.name).join("、") : "通用工程"
}

export async function runReviewPipeline(input: RunReviewPipelineInput): Promise<void> {
  const { file, modelParam, userId, lockedProfessionId, sendProgress, sendResult, sendError, close } = input
  const { client, modelName, maxOutputTokens } = getModelConfig(modelParam)

  console.log(`使用模型: ${modelParam} (${modelName})`)
  console.log(`开始审核: ${file.name}, 文件大小: ${file.size} bytes`)

  sendProgress({ stage: "file_parse", message: "正在解析文件...", percent: 5 })
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const onParseProgress: ProgressCallback = (progress) => {
    sendProgress({
      stage: progress.stage,
      message: progress.message,
      current: progress.current,
      total: progress.total,
      percent: progress.percent ? Math.min(95, 5 + progress.percent * 0.9) : undefined,
    })
  }

  let documentContent: string
  try {
    documentContent = await parseUploadedFile(fileBuffer, file.name, onParseProgress)
    console.log(`文件解析成功: ${documentContent.length} 字符`)
  } catch (parseError) {
    console.error("文件解析失败:", parseError)
    sendError(`文件解析失败: ${parseError instanceof Error ? parseError.message : "未知错误"}`)
    close()
    return
  }

  if (!documentContent || documentContent.length < 100) {
    sendError("文件内容为空或太短，无法审核")
    close()
    return
  }

  sendProgress({ stage: "knowledge_load", message: "正在匹配知识库...", percent: 96 })
  console.log("步骤 2: 智能匹配知识库...")
  const { professionTypes, anchorClauses, loadedStandards } = await extractKnowledgeContext(documentContent, lockedProfessionId)
  const professionNames = professionNamesFromTypes(professionTypes)
  const anchorClausesText = formatAnchorClauses(anchorClauses)
  const contextPlan = planReviewContext({
    modelName,
    documentContent,
    anchorClausesText,
    outputTokens: maxOutputTokens,
  })

  console.log(`识别到的专业类型: ${professionNames}`)
  console.log(`精准锚点: ${anchorClauses.length} 条（涉及 ${loadedStandards.length} 本规范）`)
  console.log(
    `[ContextBudget] mode=${contextPlan.mode}, docTokens=${contextPlan.estimatedDocumentTokens.toLocaleString()}, ` +
    `anchorTokens=${contextPlan.estimatedAnchorTokens.toLocaleString()}, input=${contextPlan.estimatedInputTokens.toLocaleString()}/` +
    `${contextPlan.availableInputTokens.toLocaleString()} tokens, reason=${contextPlan.reason}`
  )

  if (contextPlan.mode === "chunked") {
    await runChunkedReview({
      file,
      documentContent,
      client,
      modelName,
      maxOutputTokens,
      userId,
      lockedProfessionId,
      professionTypes,
      anchorClauses,
      sendProgress,
      sendResult,
      sendError,
      close,
    })
    return
  }

  const knowledgeInfo = await getKnowledgeBaseInfo()
  const currentDate = currentChineseDate()

  sendProgress({ stage: "ai_review", message: "正在进行完整性审核...", percent: 97 })
  console.log("步骤 4.1: 完整性审核阶段...")
  const completeness = await runCompletenessReviewStage({
    client,
    modelName,
    maxOutputTokens,
    filename: file.name,
    professionNames,
    currentDate,
    anchorClauses,
    documentContent,
  })

  sendProgress({ stage: "ai_review", message: "正在进行技术细节审核...", percent: 98 })
  console.log("步骤 4.2: 技术细节审核阶段...")
  const technical = await runTechnicalReviewStage({
    client,
    modelName,
    maxOutputTokens,
    filename: file.name,
    professionNames,
    currentDate,
    anchorClauses,
    documentContent,
    completenessReport: completeness.report,
  })

  sendProgress({ stage: "ai_review", message: "正在合并完整性与技术审核结果...", percent: 99 })
  console.log("步骤 4.3: 阶段报告合并...")
  const merged = await mergeStageReports({
    client,
    modelName,
    maxOutputTokens,
    filename: file.name,
    professionNames,
    currentDate,
    anchorClauses,
    documentContent,
    completenessReport: completeness.report,
    technicalReport: technical.report,
  })

  const reviewResult = merged.report
  const totalTokens = completeness.tokensUsed + technical.tokensUsed + merged.tokensUsed
  console.log(`阶段化审核完成，总 Token: ${totalTokens || "未知"}`)

  const reviewConclusion = extractConclusion(reviewResult)

  try {
    await saveReviewWithFallback(userId, {
      filename: file.name,
      file_size: file.size,
      profession_types: professionTypes.length > 0 ? professionTypes.map((p) => p.name) : [professionNames],
      document_content: documentContent.slice(0, 10000),
      review_result: reviewResult,
      review_conclusion: reviewConclusion,
      knowledge_file: `精准锚点 ${anchorClauses.length} 条（涉及 ${loadedStandards.length} 本规范）`,
      tokens_used: totalTokens,
      model: modelName,
    })
  } catch (dbError) {
    console.error("保存审核记录失败:", dbError)
  }

  sendProgress({ stage: "complete", message: "审核完成", percent: 100 })
  sendResult({
    success: true,
    result: reviewResult,
    conclusion: reviewConclusion,
    metadata: {
      filename: file.name,
      professionTypes: professionTypes.length > 0 ? professionTypes.map((p) => p.name) : [professionNames],
      loadedStandards,
      knowledgeFileCount: knowledgeInfo.fileCount,
      documentLength: documentContent.length,
      tokensUsed: totalTokens,
      reviewMode: contextPlan.mode,
      reviewStages: ["completeness", "technical", "merge"],
      estimatedInputTokens: contextPlan.estimatedInputTokens,
      availableInputTokens: contextPlan.availableInputTokens,
    },
  })
  close()
}

async function runChunkedReview(input: {
  file: File
  documentContent: string
  client: ReturnType<typeof getModelConfig>["client"]
  modelName: string
  maxOutputTokens: number
  userId: string | null
  lockedProfessionId?: string
  professionTypes?: ProfessionType[]
  anchorClauses?: MatchedClause[]
  sendProgress: RunReviewPipelineInput["sendProgress"]
  sendResult: RunReviewPipelineInput["sendResult"]
  sendError: RunReviewPipelineInput["sendError"]
  close: RunReviewPipelineInput["close"]
}): Promise<void> {
  const { file, documentContent, client, modelName, maxOutputTokens, userId, lockedProfessionId, sendProgress, sendResult, sendError, close } = input
  console.log("=== 开始分块审核流程（SSE）===")

  try {
    sendProgress({ stage: "chunk_identify", message: "正在识别专业类型...", percent: 10 })
    const professionTypes = input.professionTypes ?? (lockedProfessionId
      ? PROFESSION_TYPES.filter((p) => p.id === lockedProfessionId)
      : await identifyProfessionTypes(documentContent))
    const professionNames = professionNamesFromTypes(professionTypes)
    console.log(`专业类型: ${professionNames}${lockedProfessionId ? "(锁定)" : ""}`)

    let anchorClauses = input.anchorClauses ?? []
    if (!input.anchorClauses) {
      try {
        const features = await identifySchemeFeatures(documentContent, lockedProfessionId)
        anchorClauses = await getClausesByFeatures(features)
        console.log(`[Hook2] 分块流程精准锚点: ${anchorClauses.length} 条${lockedProfessionId ? `(锁定=${lockedProfessionId})` : ""} (构造=${features.structureType ?? "—"}, 危大=${features.hazardLevel ?? "—"})`)
      } catch (e) {
        console.warn("[Hook2] 分块流程锚点匹配失败，降级无锚点:", e instanceof Error ? e.message : e)
      }
    }

    sendProgress({ stage: "chunk_split", message: "正在分割文档...", percent: 15 })
    const chunks = splitDocumentBySections(documentContent, REVIEW_CONTEXT_LIMITS.chunkTargetChars)
    console.log(`文档已分割为 ${chunks.length} 个块`)

    sendProgress({ stage: "completeness_review", message: "正在进行完整性审核...", percent: 18 })
    const completeness = await runCompletenessReviewStage({
      client,
      modelName,
      maxOutputTokens,
      filename: file.name,
      professionNames,
      currentDate: currentChineseDate(),
      anchorClauses,
      documentContent,
    })

    const chunkReview = await reviewDocumentChunks({ chunks, anchorClauses, client, modelName, maxOutputTokens, sendProgress })

    sendProgress({ stage: "chunk_merge", message: "正在汇总审核结果...", percent: 90 })
    console.log("\n=== 开始智能汇总 ===")
    const merged = await mergeChunkReports({
      client,
      modelName,
      maxOutputTokens,
      filename: file.name,
      professionNames,
      currentDate: currentChineseDate(),
      chunkCount: chunks.length,
      anchorClauses,
      chunkReports: [
        `## 完整性阶段审核报告\n\n${completeness.report}`,
        ...chunkReview.chunkReports,
      ],
    })
    const finalResult = merged.finalResult
    const totalTokens = completeness.tokensUsed + chunkReview.totalTokens + merged.tokensUsed
    console.log(`智能汇总完成，总 Token: ${totalTokens}`)

    const reviewConclusion = extractConclusion(finalResult)

    try {
      await saveReviewWithFallback(userId, {
        filename: file.name,
        file_size: file.size,
        profession_types: professionTypes.map((p) => p.name),
        document_content: documentContent.slice(0, 10000),
        review_result: finalResult,
        review_conclusion: reviewConclusion,
        knowledge_file: `分块审核 ${chunks.length} 个块`,
        tokens_used: totalTokens,
        model: modelName,
      })
      console.log("审核记录已保存")
    } catch (dbError) {
      console.error("保存审核记录失败:", dbError)
    }

    sendProgress({ stage: "complete", message: "审核完成", percent: 100 })
    sendResult({
      success: true,
      result: finalResult,
      conclusion: reviewConclusion,
      metadata: {
        filename: file.name,
        professionTypes: professionTypes.map((p) => p.name),
        chunkCount: chunks.length,
        documentLength: documentContent.length,
        tokensUsed: totalTokens,
        reviewMode: "chunked",
        reviewStages: ["completeness", "chunked-technical", "merge"],
      },
    })
    close()
  } catch (error) {
    console.error("分块审核失败:", error)
    sendError(`分块审核失败: ${error instanceof Error ? error.message : "未知错误"}`)
    close()
  }
}
