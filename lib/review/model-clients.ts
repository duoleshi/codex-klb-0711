import OpenAI from "openai"
import { getDefaultOutputTokenBudget } from "./context-budget"
import type { ReviewModelConfig } from "./review-types"

const LOCAL_VALIDATION_API_KEY = "local-validation-placeholder-key"

export function getModelConfig(model: string): ReviewModelConfig {
  if (model === "qwen") {
    const modelName = process.env.QWEN_MODEL || "qwen-plus"
    return {
      client: new OpenAI({
        baseURL: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
        apiKey: process.env.QWEN_API_KEY || LOCAL_VALIDATION_API_KEY,
      }),
      modelName,
      maxOutputTokens: Number(process.env.QWEN_MAX_OUTPUT_TOKENS || getDefaultOutputTokenBudget(modelName)),
    }
  }

  const modelName = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
  return {
    client: new OpenAI({
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY || LOCAL_VALIDATION_API_KEY,
    }),
    modelName,
    maxOutputTokens: Number(process.env.DEEPSEEK_MAX_OUTPUT_TOKENS || getDefaultOutputTokenBudget(modelName)),
  }
}
