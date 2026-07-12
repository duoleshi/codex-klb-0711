export function extractConclusion(reviewResult: string): string {
  const patterns = [
    /总体评价[：:\s]*(合规|部分合规|不合规)/i,
    /【审核结论】\s*\n\s*总体评价[：:\s]*(合规|部分合规|不合规)/i,
    /总体评价[：:\s]*\[?(合规|部分合规|不合规)\]?/i,
    /审核结论[：:\s]*(合规|部分合规|不合规)/i,
    /结论[：:\s]*(合规|部分合规|不合规)/i,
  ]

  for (const pattern of patterns) {
    const match = reviewResult.match(pattern)
    if (match?.[1]) {
      const conclusion = match[1].trim()
      if (conclusion === "合规" || conclusion === "部分合规" || conclusion === "不合规") {
        return conclusion
      }
    }
  }

  if (reviewResult.includes("❌ 严重") || reviewResult.includes("不合规")) return "不合规"
  if (reviewResult.includes("⚠️ 一般") || reviewResult.includes("➖ 缺失") || reviewResult.includes("部分合规")) return "部分合规"
  if (reviewResult.includes("✅ 符合") || reviewResult.includes("合规")) return "合规"

  return "待确认"
}
