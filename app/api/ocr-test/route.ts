// app/api/ocr-test/route.ts
// OCR 引擎对比测试 API - 并行调用多个 OCR 引擎

import { NextRequest, NextResponse } from "next/server"
import {
  recognizeWithMinerU,
  recognizeWithBaiduOCR,
  recognizeWithTesseract,
  recognizeWithP2T,
  recognizeWithTextIn,
} from "@/lib/pdf-parser"

// OCR 引擎结果类型
interface OCREngineResult {
  engine: string
  time: number // 耗时（毫秒）
  charCount: number
  text: string
  error?: string
  status: "success" | "error" | "timeout"
}

// 所有可用的 OCR 引擎
const AVAILABLE_ENGINES = [
  "mineru",
  "baidu",
  "tesseract",
  "p2t",
  "textin",
] as const

type EngineKey = (typeof AVAILABLE_ENGINES)[number]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const enginesStr = formData.get("engines") as string | null

    if (!file) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 })
    }

    if (!enginesStr) {
      return NextResponse.json({ error: "请选择至少一个引擎" }, { status: 400 })
    }

    const selectedEngines: string[] = JSON.parse(enginesStr)

    // 验证引擎名称
    const validEngines = selectedEngines.filter((e) =>
      AVAILABLE_ENGINES.includes(e as EngineKey)
    )

    if (validEngines.length === 0) {
      return NextResponse.json({ error: "没有有效的引擎" }, { status: 400 })
    }

    // 读取文件到 Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filename = file.name

    console.log(
      `[OCR测试] 文件: ${filename}, 大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB, 引擎: ${validEngines.join(", ")}`
    )

    // 定义每个引擎的调用函数
    const engineRunners: Record<
      EngineKey,
      () => Promise<string>
    > = {
      mineru: () => recognizeWithMinerU(buffer, filename),
      baidu: () => recognizeWithBaiduOCR(buffer),
      tesseract: () => recognizeWithTesseract(buffer),
      p2t: () => recognizeWithP2T(buffer, filename),
      textin: () => recognizeWithTextIn(buffer),
    }

    // 并行调用所有选中的引擎
    const promises = validEngines.map(async (engineName) => {
      const startTime = Date.now()
      const result: OCREngineResult = {
        engine: engineName,
        time: 0,
        charCount: 0,
        text: "",
        status: "error",
      }

      try {
        const runner = engineRunners[engineName as EngineKey]
        if (!runner) {
          throw new Error(`未知引擎: ${engineName}`)
        }

        // 设置超时（5 分钟）
        const timeoutMs = 5 * 60 * 1000
        const text = await Promise.race([
          runner(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("超时（5分钟）")),
              timeoutMs
            )
          ),
        ])

        result.text = text
        result.charCount = text.length
        result.time = Date.now() - startTime
        result.status = "success"

        console.log(
          `[OCR测试] ${engineName} 完成: ${result.time}ms, ${result.charCount} 字符`
        )
      } catch (error) {
        result.time = Date.now() - startTime
        result.error =
          error instanceof Error ? error.message : String(error)
        result.status = result.error.includes("超时") ? "timeout" : "error"

        console.error(`[OCR测试] ${engineName} 失败:`, result.error)
      }

      return result
    })

    // 等待所有引擎完成
    const results = await Promise.all(promises)

    console.log(
      `[OCR测试] 全部完成: ${results.filter((r) => r.status === "success").length}/${results.length} 成功`
    )

    return NextResponse.json({ results })
  } catch (error) {
    console.error("[OCR测试] API 错误:", error)
    return NextResponse.json(
      {
        error: `服务器错误: ${error instanceof Error ? error.message : "未知错误"}`,
      },
      { status: 500 }
    )
  }
}
