export type ReviewContextMode = "single-pass" | "single-pass-trimmed-anchors" | "chunked"

export interface ReviewContextPlan {
  mode: ReviewContextMode
  estimatedDocumentTokens: number
  estimatedAnchorTokens: number
  estimatedPromptTokens: number
  estimatedInputTokens: number
  availableInputTokens: number
  reason: string
}

export const REVIEW_CONTEXT_LIMITS = {
  defaultContextTokens: 1_000_000,
  deepseekContextTokens: 1_000_000,
  qwenContextTokens: 128_000,
  defaultOutputTokens: 64_000,
  safetyTokens: 100_000,
  promptReserveTokens: 5_000,
  preferredSinglePassChars: 600_000,
  chunkTriggerChars: 800_000,
  chunkTargetChars: 250_000,
}

export function estimateTokens(text: string): number {
  if (!text) return 0

  const chineseChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const otherChars = text.length - chineseChars

  // DeepSeek 官方给出的粗略量级为中文字符约 0.6 token、英文字符约 0.3 token。
  // 这里保留 10% buffer，避免低估导致请求贴近上下文上限。
  return Math.ceil((chineseChars * 0.6 + otherChars * 0.3) * 1.1)
}

export function getModelContextTokens(modelName: string): number {
  if (modelName.startsWith("deepseek-v4")) return REVIEW_CONTEXT_LIMITS.deepseekContextTokens
  if (modelName.includes("qwen")) return REVIEW_CONTEXT_LIMITS.qwenContextTokens
  return REVIEW_CONTEXT_LIMITS.defaultContextTokens
}

export function getDefaultOutputTokenBudget(modelName: string): number {
  if (modelName.startsWith("deepseek-v4")) return REVIEW_CONTEXT_LIMITS.defaultOutputTokens
  return 16_000
}

export function getAvailableInputTokens(modelName: string, outputTokens = getDefaultOutputTokenBudget(modelName)): number {
  return Math.max(
    16_000,
    getModelContextTokens(modelName) -
      outputTokens -
      REVIEW_CONTEXT_LIMITS.safetyTokens -
      REVIEW_CONTEXT_LIMITS.promptReserveTokens
  )
}

export function planReviewContext(input: {
  modelName: string
  documentContent: string
  anchorClausesText?: string
  outputTokens?: number
}): ReviewContextPlan {
  const documentTokens = estimateTokens(input.documentContent)
  const anchorTokens = estimateTokens(input.anchorClausesText ?? "")
  const promptTokens = REVIEW_CONTEXT_LIMITS.promptReserveTokens
  const outputTokens = input.outputTokens ?? getDefaultOutputTokenBudget(input.modelName)
  const availableInputTokens = getAvailableInputTokens(input.modelName, outputTokens)
  const estimatedInputTokens = documentTokens + anchorTokens + promptTokens
  const documentChars = input.documentContent.length

  if (documentChars >= REVIEW_CONTEXT_LIMITS.chunkTriggerChars) {
    return {
      mode: "chunked",
      estimatedDocumentTokens: documentTokens,
      estimatedAnchorTokens: anchorTokens,
      estimatedPromptTokens: promptTokens,
      estimatedInputTokens,
      availableInputTokens,
      reason: `文档 ${documentChars.toLocaleString()} 字符达到智能分块阈值 ${REVIEW_CONTEXT_LIMITS.chunkTriggerChars.toLocaleString()} 字符`,
    }
  }

  if (estimatedInputTokens > availableInputTokens) {
    return {
      mode: "chunked",
      estimatedDocumentTokens: documentTokens,
      estimatedAnchorTokens: anchorTokens,
      estimatedPromptTokens: promptTokens,
      estimatedInputTokens,
      availableInputTokens,
      reason: `估算输入 ${estimatedInputTokens.toLocaleString()} tokens 超过可用预算 ${availableInputTokens.toLocaleString()} tokens`,
    }
  }

  if (
    documentChars > REVIEW_CONTEXT_LIMITS.preferredSinglePassChars ||
    estimatedInputTokens > availableInputTokens * 0.85
  ) {
    return {
      mode: "single-pass-trimmed-anchors",
      estimatedDocumentTokens: documentTokens,
      estimatedAnchorTokens: anchorTokens,
      estimatedPromptTokens: promptTokens,
      estimatedInputTokens,
      availableInputTokens,
      reason: `接近长上下文舒适区，优先全文审核并保留锚点瘦身余地`,
    }
  }

  return {
    mode: "single-pass",
    estimatedDocumentTokens: documentTokens,
    estimatedAnchorTokens: anchorTokens,
    estimatedPromptTokens: promptTokens,
    estimatedInputTokens,
    availableInputTokens,
    reason: `估算输入 ${estimatedInputTokens.toLocaleString()} tokens 低于可用预算 ${availableInputTokens.toLocaleString()} tokens，使用全文审核`,
  }
}
