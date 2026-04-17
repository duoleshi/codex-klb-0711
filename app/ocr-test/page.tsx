"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

// OCR 引擎配置
const ENGINES = [
  { id: "mineru", label: "MinerU", desc: "云端 API，Markdown 输出" },
  { id: "baidu", label: "百度 OCR", desc: "高精度版，同步调用" },
  { id: "tesseract", label: "Tesseract.js", desc: "本地 OCR，中文支持" },
  { id: "p2t", label: "Pix2Text", desc: "P2T 云端 API，异步轮询" },
  { id: "textin", label: "TextIn xParse", desc: "合合信息，Markdown 输出" },
]

// 引擎结果类型
interface EngineResult {
  engine: string
  time: number
  charCount: number
  text: string
  error?: string
  status: "success" | "error" | "timeout"
}

export default function OCRTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [selectedEngines, setSelectedEngines] = useState<string[]>([
    "mineru",
    "baidu",
    "p2t",
    "textin",
  ])
  const [results, setResults] = useState<EngineResult[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // 切换引擎选择
  const toggleEngine = (engineId: string) => {
    setSelectedEngines((prev) =>
      prev.includes(engineId)
        ? prev.filter((e) => e !== engineId)
        : [...prev, engineId]
    )
  }

  // 处理文件拖放
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const droppedFile = e.dataTransfer.files[0]
      if (
        droppedFile &&
        (droppedFile.type === "application/pdf" ||
          droppedFile.name.toLowerCase().endsWith(".pdf"))
      ) {
        setFile(droppedFile)
        setResults([])
      }
    },
    []
  )

  // 开始测试
  const startTest = async () => {
    if (!file || selectedEngines.length === 0) return

    setLoading(true)
    setResults([])
    setExpandedEngine(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("engines", JSON.stringify(selectedEngines))

      const response = await fetch("/api/ocr-test", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `请求失败: ${response.status}`)
      }

      const data = await response.json()
      setResults(data.results || [])
    } catch (error) {
      console.error("测试失败:", error)
      alert(
        `测试失败: ${error instanceof Error ? error.message : "未知错误"}`
      )
    } finally {
      setLoading(false)
    }
  }

  // 格式化耗时
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  // 引擎状态图标
  const statusIcon = (status: string) => {
    switch (status) {
      case "success":
        return "✓"
      case "timeout":
        return "⏱"
      case "error":
        return "✗"
      default:
        return "?"
    }
  }

  // 按耗时排序
  const sortedResults = [...results].sort((a, b) => a.time - b.time)

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">OCR 引擎对比测试</h1>
          <p className="text-muted-foreground">
            上传 PDF 文件，并行测试多个 OCR 引擎的识别效果和速度
          </p>
        </div>

        {/* 上传区域 */}
        <Card>
          <CardContent className="pt-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-3">
                  <div className="text-4xl">📄</div>
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFile(null)
                      setResults([])
                    }}
                  >
                    重新选择
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-4xl">📁</div>
                  <div className="font-medium">
                    拖拽 PDF 文件到此处，或点击选择
                  </div>
                  <div className="text-sm text-muted-foreground">
                    支持 PDF 格式文件
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    id="file-upload"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        setFile(f)
                        setResults([])
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      document.getElementById("file-upload")?.click()
                    }
                  >
                    选择文件
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 引擎选择 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">选择测试引擎</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {ENGINES.map((engine) => (
                <div
                  key={engine.id}
                  className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors ${
                    selectedEngines.includes(engine.id)
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  }`}
                >
                  <Checkbox
                    id={`engine-${engine.id}`}
                    checked={selectedEngines.includes(engine.id)}
                    onCheckedChange={() => toggleEngine(engine.id)}
                  />
                  <div className="space-y-1 leading-none">
                    <Label
                      htmlFor={`engine-${engine.id}`}
                      className="font-medium cursor-pointer"
                    >
                      {engine.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {engine.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-4">
              <Button
                onClick={startTest}
                disabled={!file || selectedEngines.length === 0 || loading}
                className="px-8"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⟳</span>
                    测试中...
                  </>
                ) : (
                  "开始测试"
                )}
              </Button>
              {selectedEngines.length === 0 && (
                <span className="text-sm text-destructive">
                  请至少选择一个引擎
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 结果概览表格 */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">测试结果</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">
                        引擎
                      </th>
                      <th className="text-left py-3 px-4 font-medium">排名</th>
                      <th className="text-right py-3 px-4 font-medium">
                        耗时
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        字符数
                      </th>
                      <th className="text-center py-3 px-4 font-medium">
                        状态
                      </th>
                      <th className="text-center py-3 px-4 font-medium">
                        详情
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((result, index) => {
                      const engineInfo = ENGINES.find(
                        (e) => e.id === result.engine
                      )
                      return (
                        <tr
                          key={result.engine}
                          className="border-b last:border-0 hover:bg-muted/50"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium">
                              {engineInfo?.label || result.engine}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {result.status === "success" ? (
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                  index === 0
                                    ? "bg-yellow-500/20 text-yellow-600"
                                    : index === 1
                                      ? "bg-gray-500/20 text-gray-600"
                                      : "bg-orange-500/20 text-orange-600"
                                }`}
                              >
                                {index + 1}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatTime(result.time)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {result.charCount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                result.status === "success"
                                  ? "bg-green-500/20 text-green-600"
                                  : result.status === "timeout"
                                    ? "bg-yellow-500/20 text-yellow-600"
                                    : "bg-red-500/20 text-red-600"
                              }`}
                            >
                              {statusIcon(result.status)}
                              {result.status === "success"
                                ? "完成"
                                : result.status === "timeout"
                                  ? "超时"
                                  : "失败"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {result.status === "success" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setExpandedEngine(
                                    expandedEngine === result.engine
                                      ? null
                                      : result.engine
                                  )
                                }
                              >
                                {expandedEngine === result.engine
                                  ? "收起"
                                  : "查看"}
                              </Button>
                            ) : (
                              <span
                                className="text-xs text-destructive"
                                title={result.error}
                              >
                                {result.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 展开的文本详情 */}
        {expandedEngine && results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {
                  ENGINES.find((e) => e.id === expandedEngine)?.label
                }{" "}
                - 识别文本
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const result = results.find(
                  (r) => r.engine === expandedEngine
                )
                if (!result) return null
                return (
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[600px] overflow-y-auto font-mono leading-relaxed">
                    {result.text}
                  </pre>
                )
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
