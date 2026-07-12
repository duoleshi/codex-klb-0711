import type OpenAI from "openai"
import type { MatchedClause } from "@/lib/clauses/clause-types"
import {
  buildCompletenessReviewPrompt,
  buildStageMergePrompt,
  buildTechnicalReviewPrompt,
  formatAnchorClauses,
  REVIEW_SYSTEM_PROMPT,
  MERGE_SYSTEM_PROMPT,
} from "@/lib/prompts/review-prompts"
import { normalizeReviewMarkdown } from "./report-markdown"

export type StageReviewResult = {
  report: string
  tokensUsed: number
}

type StageReviewInput = {
  client: OpenAI
  modelName: string
  maxOutputTokens: number
  filename: string
  professionNames: string
  currentDate: string
  anchorClauses: MatchedClause[]
  documentContent: string
}

function selectCompletenessClauses(anchorClauses: MatchedClause[]): MatchedClause[] {
  const selected = anchorClauses.filter(
    (c) =>
      c.profession === "general" ||
      c.standard_code === "建办质〔2024〕63号" ||
      c.standard_code === "建办质〔2021〕48号"
  )
  return selected.length > 0 ? selected : anchorClauses
}

function selectTechnicalClauses(anchorClauses: MatchedClause[]): MatchedClause[] {
  const selected = anchorClauses.filter((c) => c.profession !== "general")
  return selected.length > 0 ? selected : anchorClauses
}

async function createStageCompletion(input: {
  client: OpenAI
  modelName: string
  maxOutputTokens: number
  systemPrompt: string
  userPrompt: string
}): Promise<StageReviewResult> {
  const completion = await input.client.chat.completions.create({
    model: input.modelName,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
    stream: false,
    temperature: 0.2,
    max_tokens: input.maxOutputTokens,
  })

  const report = completion.choices[0]?.message?.content
  if (!report) throw new Error("AI 阶段审核返回结果为空")

  return {
    report: normalizeReviewMarkdown(report),
    tokensUsed: completion.usage?.total_tokens || 0,
  }
}

export async function runCompletenessReviewStage(input: StageReviewInput): Promise<StageReviewResult> {
  const completenessClauses = selectCompletenessClauses(input.anchorClauses)
  const prompt = buildCompletenessReviewPrompt(
    input.filename,
    input.professionNames,
    input.currentDate,
    completenessClauses.length.toString(),
    formatAnchorClauses(completenessClauses),
    input.documentContent
  )

  return createStageCompletion({
    client: input.client,
    modelName: input.modelName,
    maxOutputTokens: input.maxOutputTokens,
    systemPrompt: REVIEW_SYSTEM_PROMPT,
    userPrompt: prompt,
  })
}

export async function runTechnicalReviewStage(
  input: StageReviewInput & { completenessReport: string }
): Promise<StageReviewResult> {
  const technicalClauses = selectTechnicalClauses(input.anchorClauses)
  const prompt = buildTechnicalReviewPrompt(
    input.filename,
    input.professionNames,
    input.currentDate,
    technicalClauses.length.toString(),
    formatAnchorClauses(technicalClauses),
    input.documentContent,
    input.completenessReport
  )

  return createStageCompletion({
    client: input.client,
    modelName: input.modelName,
    maxOutputTokens: input.maxOutputTokens,
    systemPrompt: REVIEW_SYSTEM_PROMPT,
    userPrompt: prompt,
  })
}

export async function mergeStageReports(
  input: StageReviewInput & {
    completenessReport: string
    technicalReport: string
  }
): Promise<StageReviewResult> {
  const prompt = buildStageMergePrompt(
    input.filename,
    input.professionNames,
    input.currentDate,
    input.anchorClauses.length.toString(),
    input.completenessReport,
    input.technicalReport,
    formatAnchorClauses(input.anchorClauses)
  )

  return createStageCompletion({
    client: input.client,
    modelName: input.modelName,
    maxOutputTokens: input.maxOutputTokens,
    systemPrompt: MERGE_SYSTEM_PROMPT,
    userPrompt: prompt,
  })
}
