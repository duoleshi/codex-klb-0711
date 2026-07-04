"use client"

import { useState, useEffect, useCallback } from "react"
import { FileCheck, RefreshCw, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { FileUpload } from "@/components/file-upload"
import { ReviewResult } from "@/components/review-result"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ReviewStatus = "idle" | "reviewing" | "success" | "error"

// SSE 进度事件类型
interface ProgressEvent {
  type?: string
  stage: string
  message: string
  current?: number
  total?: number
  percent?: number
}

interface ReviewResponse {
  success: boolean
  result?: string
  conclusion?: string
  error?: string
  metadata?: {
    filename: string
    professionTypes: string[]
    loadedFiles?: string[]
    knowledgeFileCount?: number
    documentLength: number
    tokensUsed?: number
    chunkCount?: number
    reviewMode?: string
  }
}

// 进度条组件
function ProgressDisplay({
  progress,
  percent
}: {
  progress: ProgressEvent | null
  percent: number
}) {
  if (!progress) return null

  return (
    <div className="w-full space-y-3">
      {/* 进度条 */}
      <div className="space-y-1.5">
        <Progress value={percent} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress.message}</span>
          <span>{Math.round(percent)}%</span>
        </div>
      </div>

      {/* 详细信息 */}
      {progress.current !== undefined && progress.total !== undefined && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>
            {progress.stage === "pdf_ocr" && `OCR 识别: ${progress.current}/${progress.total} 页`}
            {progress.stage === "chunk_review" && `审核进度: ${progress.current}/${progress.total} 块`}
            {progress.stage === "knowledge_load" && "正在匹配知识库..."}
            {progress.stage === "ai_review" && "AI 正在审核..."}
          </span>
        </div>
      )}
    </div>
  )
}

export function Hero() {
  const [file, setFile] = useState<File | null>(null)
  const [professions, setProfessions] = useState<{ id: string; name: string }[]>([])
  const [selectedProfession, setSelectedProfession] = useState<string>("auto")
  const [selectedModel, setSelectedModel] = useState<string>("deepseek")
  const [status, setStatus] = useState<ReviewStatus>("idle")
  const [result, setResult] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [progress, setProgress] = useState<ProgressEvent | null>(null)
  const [percent, setPercent] = useState(0)

  // 拉取 13 危大专业列表（下拉动态渲染，避免硬编码与后端不一致）
  useEffect(() => {
    fetch("/api/professions")
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) => setProfessions(data))
      .catch(() => {})
  }, [])

  const handleReview = useCallback(async () => {
    if (!file) return

    setStatus("reviewing")
    setError("")
    setResult("")
    setProgress({ stage: "init", message: "正在初始化...", percent: 0 })
    setPercent(0)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("model", selectedModel)
      if (selectedProfession && selectedProfession !== "auto") {
        formData.append("profession", selectedProfession)
      }

      // 使用 fetch + ReadableStream 接收 SSE
      const response = await fetch("/api/review", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("无法读取响应流")
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 解析 SSE 事件
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || "" // 保留未完成的部分

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.slice(6))

              if (eventData.type === "progress") {
                // 更新进度
                setProgress(eventData)
                if (eventData.percent !== undefined) {
                  setPercent(eventData.percent)
                }
              } else if (eventData.type === "result") {
                // 审核完成
                if (eventData.success) {
                  setResult(eventData.result || "")
                  setStatus("success")
                  setPercent(100)
                } else {
                  throw new Error(eventData.error || "审核失败")
                }
              } else if (eventData.type === "error") {
                throw new Error(eventData.error || "审核失败")
              }
            } catch (parseError) {
              // 如果不是 JSON，忽略这个事件
              if (line.includes("error")) {
                console.error("SSE 解析错误:", line)
              }
            }
          }
        }
      }

      // 如果流结束但没有收到结果，检查状态
      if (status === "reviewing") {
        // 流可能已经结束但没有明确的结果事件
        // 这种情况不应该发生，但作为安全措施
        console.warn("流结束但未收到结果事件")
      }
    } catch (err) {
      console.error("审核错误:", err)
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("网络连接失败，请检查网络后重试")
      } else {
        setError(err instanceof Error ? err.message : "审核失败，请重试")
      }
      setStatus("error")
    }
  }, [file, status])

  const handleRetry = () => {
    setStatus("idle")
    setError("")
    setResult("")
    setProgress(null)
    setPercent(0)
  }

  return (
    <section id="top" className="py-12 md:py-20">
      <div className="mx-auto max-w-3xl px-4">
        {/* Hero Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI 智能审核</span>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            重工施工方案AI智能审核系统(自研)
          </h1>
          <p className="text-lg text-muted-foreground">
            上传工程方案文件，AI 自动分析并生成专业审核意见
          </p>
        </div>

        {/* Upload Card */}
        <Card className="shadow-lg">
          <CardContent className="space-y-6 p-6">
            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                上传方案文件
              </label>
              <FileUpload file={file} onFileChange={setFile} />
            </div>

            {/* Profession Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                选择专业领域
              </label>
              <Select value={selectedProfession} onValueChange={setSelectedProfession}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择专业领域..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">自动识别（默认）</SelectItem>
                  {professions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                选择模型
              </label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择审核模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="qwen">千问百炼</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleReview}
              disabled={!file || status === "reviewing"}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 disabled:bg-accent/50"
              size="lg"
            >
              {status === "reviewing" ? (
                <>
                  <Spinner className="mr-2 h-5 w-5" />
                  正在审核...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-5 w-5" />
                  开始审核
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Reviewing State with Progress */}
        <div
          style={{ display: status === "reviewing" ? "block" : "none" }}
          className="mt-6"
        >
          <Card className="border-primary/20">
            <CardContent className="flex flex-col items-center justify-center py-8 px-6">
              <div className="w-full max-w-md space-y-4">
                {/* 图标和标题 */}
                <div className="flex flex-col items-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="mt-4 text-lg font-medium text-primary">
                    正在审核中...
                  </p>
                </div>

                {/* 进度条 */}
                <ProgressDisplay progress={progress} percent={percent} />

                {/* 提示信息 */}
                <p className="text-center text-sm text-muted-foreground">
                  {progress?.stage === "pdf_ocr"
                    ? "扫描版 PDF 需要进行 OCR 识别，这可能需要 1-3 分钟"
                    : "AI 正在分析您的工程方案，请稍候"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        <div
          style={{ display: status === "error" ? "block" : "none" }}
          className="mt-6"
        >
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-lg font-medium text-destructive">审核失败</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button
                onClick={handleRetry}
                variant="outline"
                className="mt-4 gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                重试
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Success State */}
        {status === "success" && (
          <div className="mt-6 w-full">
            <p className="text-sm text-muted-foreground mb-2">审核完成，结果显示如下：</p>
            <ReviewResult content={result} />
          </div>
        )}
      </div>
    </section>
  )
}
