import type OpenAI from "openai"
import type { MatchedClause } from "@/lib/clauses/clause-types"
import { buildMergePrompt, formatAnchorClauses, MERGE_SYSTEM_PROMPT } from "@/lib/prompts/review-prompts"
import { normalizeReviewMarkdown } from "./report-markdown"

export async function mergeChunkReports(input: {
  client: OpenAI
  modelName: string
  maxOutputTokens: number
  filename: string
  professionNames: string
  currentDate: string
  chunkCount: number
  anchorClauses: MatchedClause[]
  chunkReports: string[]
}): Promise<{ finalResult: string; tokensUsed: number }> {
  const { client, modelName, maxOutputTokens, filename, professionNames, currentDate, chunkCount, anchorClauses, chunkReports } = input
  const mergePrompt = buildMergePrompt(
    filename,
    professionNames,
    currentDate,
    chunkCount.toString(),
    anchorClauses.length.toString(),
    chunkReports.join("\n\n---\n\n"),
    formatAnchorClauses(anchorClauses)
  )

  const mergeCompletion = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: "system", content: MERGE_SYSTEM_PROMPT },
      { role: "user", content: mergePrompt },
    ],
    stream: false,
    temperature: 0.2,
    max_tokens: maxOutputTokens,
  })

  return {
    finalResult: normalizeReviewMarkdown(mergeCompletion.choices[0]?.message?.content || ""),
    tokensUsed: mergeCompletion.usage?.total_tokens || 0,
  }
}
