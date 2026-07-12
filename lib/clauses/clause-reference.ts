import type { Clause } from "./clause-types"

const ORDER_NUMBER_PATTERNS = [
  /令第.+号/,
  /^建办质〔\d{4}〕\d+号$/,
  /^建质规〔\d{4}〕\d+号$/,
  /^建质〔\d{4}〕\d+号$/,
  /^粤建规范〔\d{4}〕\d+号$/,
]

function isOrderNumberLike(value: string): boolean {
  return ORDER_NUMBER_PATTERNS.some((pattern) => pattern.test(value))
}

export function formatClauseNumber(clauseNo: string): string {
  const normalized = clauseNo.trim()
  if (!normalized) return ""

  if (normalized.startsWith("第") || normalized.includes("条") || normalized.startsWith("附录")) {
    return normalized
  }

  return `第${normalized}条`
}

export function formatStandardName(clause: Pick<Clause, "standard_code" | "standard_name">): string {
  const code = clause.standard_code.trim()
  const name = clause.standard_name.trim()

  if (!name || name === code) return `《${code}》`
  if (isOrderNumberLike(code)) return `《${name}》`

  return `《${code}》`
}

export function formatClauseReference(
  clause: Pick<Clause, "standard_code" | "standard_name" | "clause_no">
): string {
  return `${formatStandardName(clause)}${formatClauseNumber(clause.clause_no)}`
}
