import type OpenAI from "openai"
import type { DocumentChunk } from "@/lib/knowledge/chunking"
import type { MatchedClause } from "@/lib/clauses/clause-types"
import { buildChunkReviewPrompt, formatAnchorClauses, REVIEW_SYSTEM_PROMPT } from "@/lib/prompts/review-prompts"
import type { ProgressEvent } from "./review-types"

const GENERIC_WORDS = new Set(["钢管", "立杆", "水平杆", "横杆", "搭设", "拆除", "检查", "验收", "设计计算", "施工", "材料"])

export function assignClausesToChunks(
  anchorClauses: MatchedClause[],
  chunks: DocumentChunk[]
): Map<number, MatchedClause[]> {
  const map = new Map<number, MatchedClause[]>()
  if (anchorClauses.length === 0) return map

  for (const chunk of chunks) {
    const matched: MatchedClause[] = []

    for (const clause of anchorClauses) {
      const tags = [clause.trigger_materials, clause.trigger_processes]
        .filter((s): s is string => !!s)
        .join(",")
        .split(",")
        .map((s) => s.trim())
        .filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w))
      const titleWords = clause.clause_title
        .split(/[\s（）()、/\\-]+/)
        .map((s) => s.trim())
        .filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w))
      const hit = tags.some((t) => chunk.content.includes(t)) || titleWords.some((w) => chunk.content.includes(w))
      if (hit) matched.push(clause)
    }

    if (matched.length) map.set(chunk.id, matched)
  }

  return map
}

export async function reviewDocumentChunks(input: {
  chunks: DocumentChunk[]
  anchorClauses: MatchedClause[]
  client: OpenAI
  modelName: string
  maxOutputTokens: number
  sendProgress: (event: ProgressEvent) => void
}): Promise<{ chunkReports: string[]; totalTokens: number }> {
  const { chunks, anchorClauses, client, modelName, maxOutputTokens, sendProgress } = input
  const chunkAnchorMap = assignClausesToChunks(anchorClauses, chunks)
  console.log(`[Hook3] 锚点分配: ${[...chunkAnchorMap.entries()].map(([id, cs]) => `块${id + 1}=${cs.length}条`).join(", ")}`)

  const chunkReports: string[] = []
  let totalTokens = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const chunkPercent = 25 + Math.round((i / chunks.length) * 60)

    sendProgress({
      stage: "chunk_review",
      message: `正在审核块 ${i + 1}/${chunks.length}: "${chunk.chapterTitle.slice(0, 30)}..."`,
      current: i + 1,
      total: chunks.length,
      percent: chunkPercent,
    })

    console.log(`\n--- 审核块 ${i + 1}/${chunks.length}: "${chunk.chapterTitle}" (${chunk.charCount} 字符) ---`)

    const chunkAnchors = chunkAnchorMap.get(chunk.id) ?? []
    const chunkAnchorText = formatAnchorClauses(chunkAnchors) || "（本片段无专项锚点，按通用要求审核）"
    const prompt = buildChunkReviewPrompt(chunk.chapterTitle, chunkAnchorText, chunk.content)

    const completion = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      stream: false,
      temperature: 0.2,
      max_tokens: maxOutputTokens,
    })

    const chunkResult = completion.choices[0]?.message?.content || ""
    totalTokens += completion.usage?.total_tokens || 0
    chunkReports.push(`## 块 ${i + 1}: ${chunk.chapterTitle}\n\n${chunkResult}`)
    console.log(`块 ${i + 1} 审核完成，Token: ${completion.usage?.total_tokens || "未知"}`)
  }

  return { chunkReports, totalTokens }
}
