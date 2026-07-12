import type { ProgressEvent } from "./review-types"

export function createSSEEncoder() {
  const encoder = new TextEncoder()

  return {
    encode: (event: ProgressEvent) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
    encodeResult: (data: unknown) => encoder.encode(`data: ${JSON.stringify({ type: "result", ...(data as object) })}\n\n`),
    encodeError: (error: string) => encoder.encode(`data: ${JSON.stringify({ type: "error", error })}\n\n`),
  }
}
