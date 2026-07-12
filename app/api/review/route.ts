import { NextRequest } from "next/server"
import { createSSEEncoder } from "@/lib/review/progress-stream"
import { runReviewPipeline } from "@/lib/review/review-pipeline"
import type { ProgressEvent } from "@/lib/review/review-types"
import { getCurrentUserId } from "@/lib/supabase/server"

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId()

  console.log("=== 开始审核请求 ===", userId ? `(用户: ${userId.slice(0, 8)}...)` : "(游客模式)")
  console.log("环境检查:", {
    nodeEnv: process.env.NODE_ENV,
    hasApiKey: !!process.env.DEEPSEEK_API_KEY,
    cwd: process.cwd(),
  })

  const encoder = createSSEEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (event: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode({ type: "progress", ...event }))
        } catch {
          // 流已关闭，忽略。
        }
      }

      const sendResult = (data: unknown) => {
        try {
          controller.enqueue(encoder.encodeResult(data))
        } catch {
          // 流已关闭，忽略。
        }
      }

      const sendError = (error: string) => {
        try {
          controller.enqueue(encoder.encodeError(error))
        } catch {
          // 流已关闭，忽略。
        }
      }

      const close = () => {
        try {
          controller.close()
        } catch {
          // 流已关闭，忽略。
        }
      }

      try {
        const formData = await request.formData()
        const file = formData.get("file") as File | null
        const modelParam = (formData.get("model") as string) || "deepseek"
        const lockedProfessionId = (formData.get("profession") as string) || undefined

        if (!file) {
          sendError("请上传文件")
          close()
          return
        }

        await runReviewPipeline({
          file,
          modelParam,
          userId,
          lockedProfessionId,
          sendProgress,
          sendResult,
          sendError,
          close,
        })
      } catch (error) {
        console.error("审核失败:", error)
        sendError(`审核失败: ${error instanceof Error ? error.message : "未知错误"}`)
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
