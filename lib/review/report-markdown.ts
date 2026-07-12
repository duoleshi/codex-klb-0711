const ISSUE_FIELD_LABELS = [
  "问题描述",
  "方案对应内容",
  "依据",
  "整改要求/建议",
]

const BROKEN_FIELD_PATTERN = new RegExp(
  `^\\s*-?\\s*【(${ISSUE_FIELD_LABELS.map((label) => label.replace("/", "\\/")).join("|")})】\\*\\*\\s*(.*)$`
)

function stripPreamble(markdown: string): string {
  const reportTitle = markdown.match(/^#\s+.+审核报告\s*$/m)
  if (!reportTitle || reportTitle.index === undefined) return markdown
  return markdown.slice(reportTitle.index)
}

function normalizeRangeTildes(line: string): string {
  return line.replace(/(\d+(?:\.\d+)?\s*[a-zA-Z%‰]*)~(?=\d)/g, "$1～")
}

export function normalizeReviewMarkdown(markdown: string): string {
  const normalizedLines = stripPreamble(markdown)
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*-\s*\*\*\s*$/.test(line)) return null
      if (/^\s*-{3,}\s*$/.test(line)) return null

      const brokenField = line.match(BROKEN_FIELD_PATTERN)
      if (brokenField) {
        const [, label, value] = brokenField
        return normalizeRangeTildes(`- **【${label}】**${value ? ` ${value.trim()}` : ""}`)
      }

      return normalizeRangeTildes(line)
    })
    .filter((line): line is string => line !== null)

  return normalizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}
