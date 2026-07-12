// scripts/check-context-budget.ts
// 验证 DeepSeek 1M 上下文下的审核调度策略。
// 运行：npx tsx scripts/check-context-budget.ts

import { getModelConfig } from "../lib/review/model-clients"
import {
  estimateTokens,
  planReviewContext,
  REVIEW_CONTEXT_LIMITS,
} from "../lib/review/context-budget"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✅ ${message}`)
  }
}

function zh(length: number): string {
  return "基".repeat(length)
}

function main() {
  const deepseek = getModelConfig("deepseek")
  assert(deepseek.modelName === "deepseek-v4-flash", "DeepSeek 默认模型为 deepseek-v4-flash")
  assert(deepseek.maxOutputTokens >= 64000, "DeepSeek 输出 token 预算不少于 64000")

  const tenChars = "基坑工程ABC123"
  const estimated = estimateTokens(tenChars)
  assert(estimated > 0 && estimated < tenChars.length, "token 估算按中英文混合文本返回合理值")

  const small = planReviewContext({
    modelName: deepseek.modelName,
    documentContent: zh(100_000),
    anchorClausesText: zh(20_000),
  })
  assert(small.mode === "single-pass", "10 万字方案走全文审核")

  const medium = planReviewContext({
    modelName: deepseek.modelName,
    documentContent: zh(500_000),
    anchorClausesText: zh(30_000),
  })
  assert(medium.mode === "single-pass", "50 万字方案仍走全文审核")

  const large = planReviewContext({
    modelName: deepseek.modelName,
    documentContent: zh(900_000),
    anchorClausesText: zh(40_000),
  })
  assert(large.mode === "chunked", "90 万字方案触发智能分块兜底")

  assert(REVIEW_CONTEXT_LIMITS.chunkTargetChars >= 200_000, "分块目标不低于 20 万字符")

  if (process.exitCode) {
    console.error("\n❌ 上下文预算验证未通过")
    process.exit(process.exitCode)
  }

  console.log("\n✅ 上下文预算验证通过")
}

main()
