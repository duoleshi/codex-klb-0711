"use client"

import { isValidElement, useMemo, useState, type ReactNode } from "react"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileDown,
  FileSpreadsheet,
  FileText,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import type { PluggableList } from "unified"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { normalizeReviewMarkdown } from "@/lib/review/report-markdown"
import { buildPrintableReportHtml } from "@/lib/review/report-export"
import { buildExcelReportBlob } from "@/lib/review/report-excel-export"
import { buildWordReportBlob } from "@/lib/review/report-word-export"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Section {
  id: string
  title: string
  content: string
}

interface ReviewResultProps {
  content: string
}

interface CompletenessAuditRow {
  sequence: string
  item: string
  conclusion: string
  level: string
  evidence: string
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  已提供: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  不完整: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  缺失: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  不适用: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300",
  致命缺陷: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  技术问题: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300",
  管理问题: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
  符合要求: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
}

const CONCLUSION_LABELS = ["已提供", "不完整", "缺失", "不适用"]
const LEVEL_LABELS = ["致命缺陷", "技术问题", "管理问题", "符合要求", "不适用"]
const markdownPlugins: PluggableList = [[remarkGfm, { singleTilde: false }]]

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textFromNode).join("")
  if (isValidElement(node)) {
    return textFromNode((node.props as { children?: ReactNode }).children)
  }
  return ""
}

function StatusAwareCell({ children }: { children: ReactNode }) {
  const text = textFromNode(children).trim()
  const compact = text.replace(/\s+/g, "")
  const badgeClass = STATUS_BADGE_CLASS[compact]

  if (badgeClass) {
    return (
      <Badge variant="outline" className={cn("rounded-sm font-semibold", badgeClass)}>
        {text}
      </Badge>
    )
  }

  return <>{children}</>
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function normalizeCell(value: string): string {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/\*\*/g, "").trim()
}

function inferLevel(conclusion: string): string {
  const compact = conclusion.replace(/\s+/g, "")
  if (compact.includes("已提供")) return "符合要求"
  if (compact.includes("不适用")) return "不适用"
  if (compact.includes("缺失")) return "致命缺陷"
  if (compact.includes("不完整")) return "管理问题"
  return "管理问题"
}

function findHeaderIndex(headers: string[], name: string): number {
  return headers.findIndex((header) => header === name || header.startsWith(`${name}（`))
}

function parseCompletenessAuditTable(markdown: string): CompletenessAuditRow[] {
  const lines = markdown.split("\n")
  const tableStart = lines.findIndex((line, index) => {
    if (!line.includes("|")) return false
    const header = splitMarkdownTableRow(line)
    const next = lines[index + 1] ?? ""
    return (
      findHeaderIndex(header, "序号") >= 0 &&
      findHeaderIndex(header, "必审项") >= 0 &&
      findHeaderIndex(header, "核查结论") >= 0 &&
      /^\s*\|?\s*:?-{3,}/.test(next)
    )
  })

  if (tableStart === -1) return []

  const headers = splitMarkdownTableRow(lines[tableStart])
  const rows: CompletenessAuditRow[] = []

  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes("|") || !line.trim().startsWith("|")) break

    const cells = splitMarkdownTableRow(line).map(normalizeCell)
    if (cells.length < 3) continue

    const get = (name: string) => {
      const index = findHeaderIndex(headers, name)
      return index >= 0 ? cells[index] ?? "" : ""
    }
    const conclusion = get("核查结论")
    const level = get("问题等级") || inferLevel(conclusion)

    rows.push({
      sequence: get("序号") || String(rows.length + 1),
      item: get("必审项"),
      conclusion,
      level,
      evidence: get("方案对应内容"),
    })
  }

  return rows
}

function reportFilename(extension: string): string {
  const date = new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")
  return `审核报告_${date}.${extension}`
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function CompletenessAuditPanel({ section }: { section: Section }) {
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(() => parseCompletenessAuditTable(section.content), [section.content])

  if (rows.length === 0) {
    return (
      <ReactMarkdown remarkPlugins={markdownPlugins} components={markdownComponents}>
        {section.content}
      </ReactMarkdown>
    )
  }

  const countBy = (labels: string[], selector: (row: CompletenessAuditRow) => string) =>
    labels.map((label) => ({
      label,
      count: rows.filter((row) => selector(row).replace(/\s+/g, "") === label).length,
    }))
  const conclusionStats = countBy(CONCLUSION_LABELS, (row) => row.conclusion)
  const levelStats = countBy(LEVEL_LABELS, (row) => row.level)
  const problemCount = rows.filter((row) => !["已提供", "不适用"].includes(row.conclusion.replace(/\s+/g, ""))).length
  const score = Math.round((rows.filter((row) => row.conclusion.replace(/\s+/g, "") === "已提供").length / rows.length) * 100)

  return (
    <section className="rounded-lg border bg-background shadow-sm">
      <div className="border-b bg-muted/25 px-4 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-normal text-foreground">3. 完整性必审项核查</h2>
            <Badge variant="outline" className="rounded-sm bg-background">SaaS 核查表</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            共 {rows.length} 项，待整改 {problemCount} 项，完整性得分 {score} 分。
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {conclusionStats.map((stat) => (
            <div key={stat.label} className="rounded-md border bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className="mt-1 text-lg font-semibold">{stat.count} 项</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {levelStats.filter((stat) => stat.count > 0).map((stat) => (
            <Badge key={stat.label} variant="outline" className={cn("rounded-sm", STATUS_BADGE_CLASS[stat.label])}>
              {stat.label} {stat.count} 项
            </Badge>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 gap-1.5 px-0 text-primary hover:bg-transparent"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? "收起详情" : "展开详情"}
        </Button>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed border-collapse text-sm [&_th:nth-child(1)]:w-[6%] [&_th:nth-child(2)]:w-[25%] [&_th:nth-child(3)]:w-[12%] [&_th:nth-child(4)]:w-[12%] [&_th:nth-child(5)]:w-[45%]">
            <thead className="bg-muted/70 text-xs text-muted-foreground">
              <tr>
                <th className="border-r px-3 py-3 text-left font-semibold">序号</th>
                <th className="border-r px-3 py-3 text-left font-semibold">必审项</th>
                <th className="border-r px-3 py-3 text-left font-semibold">核查结论</th>
                <th className="border-r px-3 py-3 text-left font-semibold">问题等级</th>
                <th className="px-3 py-3 text-left font-semibold">方案对应内容</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={`${row.sequence}-${row.item}`} className="align-top hover:bg-muted/30">
                  <td className="border-r px-3 py-3 text-muted-foreground">{row.sequence}</td>
                  <td className="border-r px-3 py-3 font-medium text-foreground">{row.item}</td>
                  <td className="border-r px-3 py-3"><StatusAwareCell>{row.conclusion}</StatusAwareCell></td>
                  <td className="border-r px-3 py-3"><StatusAwareCell>{row.level}</StatusAwareCell></td>
                  <td className="px-3 py-3 leading-6 text-foreground/90">{row.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-5 border-b pb-4 text-2xl font-semibold tracking-normal text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 mb-4 scroll-m-20 text-xl font-semibold tracking-normal text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-3 text-base font-semibold tracking-normal text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-3 leading-7 text-foreground/90">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 ml-5 list-disc space-y-1.5 text-foreground/90">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 ml-5 list-decimal space-y-1.5 text-foreground/90">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-primary/30 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[820px] table-fixed border-collapse text-sm [&_th:nth-child(1)]:w-[6%] [&_th:nth-child(2)]:w-[25%] [&_th:nth-child(3)]:w-[12%] [&_th:nth-child(4)]:w-[12%] [&_th:nth-child(5)]:w-[45%]">
          {children}
        </table>
      </div>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/70 text-xs uppercase tracking-normal text-muted-foreground">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border bg-background">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="align-top transition-colors hover:bg-muted/30">
      {children}
    </tr>
  ),
  th: ({ children }) => {
    const text = textFromNode(children).trim()
    const label = text.startsWith("核查结论") ? "核查结论" : text
    return (
    <th className="border-r px-3 py-3 text-left font-semibold whitespace-normal last:border-r-0">
      {label || children}
    </th>
    )
  },
  td: ({ children }) => (
    <td className="border-r px-3 py-3 leading-6 text-foreground/90 whitespace-normal break-words last:border-r-0">
      <StatusAwareCell>{children}</StatusAwareCell>
    </td>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  code: ({ children, className }) => (
    <code className={cn("rounded bg-muted px-1.5 py-0.5 text-[0.85em]", className)}>
      {children}
    </code>
  ),
}

// 解析审核结果文本，按 Markdown 标题（##）分割
function parseSections(text: string): Section[] {
  const sections: Section[] = []

  // 匹配 ## 标题 格式
  const regex = /^(## \d+\. .+)$/gm
  let match
  let foundAny = false

  // 查找所有 ## 标题
  const matches: { title: string; index: number }[] = []
  while ((match = regex.exec(text)) !== null) {
    matches.push({ title: match[1], index: match.index })
    foundAny = true
  }

  if (!foundAny) {
    // 没有找到 ## 标题格式，尝试按【xxx】分割
    const legacyRegex = /【([^】]+)】/g
    const legacyMatches: { title: string; index: number }[] = []
    while ((match = legacyRegex.exec(text)) !== null) {
      legacyMatches.push({ title: match[1], index: match.index })
    }

    if (legacyMatches.length > 0) {
      // 按【xxx】分割
      legacyMatches.forEach((m, i) => {
        const startIndex = m.index
        const endIndex = i < legacyMatches.length - 1 ? legacyMatches[i + 1].index : text.length
        const content = text.substring(startIndex, endIndex).trim()

        sections.push({
          id: `section-${i}`,
          title: m.title,
          content: content,
        })
      })
      return sections
    }

    // 都没有找到，返回整个内容
    return [{ id: "0", title: "", content: text }]
  }

  // 提取头部内容（第一个 ## 标题之前的内容，包括 # 标题）
  if (matches[0].index > 0) {
    const headerContent = text.substring(0, matches[0].index).trim()
    if (headerContent) {
      sections.push({
        id: "header",
        title: "报告头部",
        content: headerContent,
      })
    }
  }

  // 提取每个区块
  matches.forEach((m, i) => {
    const startIndex = m.index
    const endIndex = i < matches.length - 1 ? matches[i + 1].index : text.length
    const content = text.substring(startIndex, endIndex).trim()

    sections.push({
      id: `section-${i}`,
      title: m.title.replace(/^## /, ""),
      content: content,
    })
  })

  return sections
}

// 将区块合并回文本
function sectionsToText(sections: Section[]): string {
  return sections.map((s) => s.content).join("\n\n")
}

function isCompletenessSection(section: Section): boolean {
  return section.title.includes("完整性必审项核查") || section.content.includes("完整性必审项核查")
}

export function ReviewResult({ content: initialContent }: ReviewResultProps) {
  const [sections, setSections] = useState<Section[]>(() => parseSections(normalizeReviewMarkdown(initialContent)))
  const [copied, setCopied] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newContent, setNewContent] = useState("")

  // 当前完整的审核结果文本
  const currentContent = useMemo(() => sectionsToText(sections), [sections])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("复制失败:", err)
    }
  }

  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("请允许弹出窗口以导出 PDF")
      return
    }
    printWindow.document.write(buildPrintableReportHtml(currentContent))
    printWindow.document.close()
    printWindow.onload = () => setTimeout(() => printWindow.print(), 200)
  }

  const handleDownloadExcel = async () => {
    try {
      downloadBlob(reportFilename("xlsx"), await buildExcelReportBlob(currentContent))
    } catch (error) {
      console.error("Excel 导出失败:", error)
      alert("Excel 导出失败，请稍后重试")
    }
  }

  const handleDownloadWord = async () => {
    try {
      downloadBlob(reportFilename("docx"), await buildWordReportBlob(currentContent))
    } catch (error) {
      console.error("Word 导出失败:", error)
      alert("Word 导出失败，请稍后重试")
    }
  }

  const handleEdit = (section: Section) => {
    setEditingId(section.id)
    setEditContent(section.content)
  }

  const handleSaveEdit = () => {
    if (editingId) {
      setSections((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, content: editContent } : s))
      )
      setEditingId(null)
      setEditContent("")
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent("")
  }

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      setSections((prev) => prev.filter((s) => s.id !== deleteTargetId))
    }
    setDeleteDialogOpen(false)
    setDeleteTargetId(null)
  }

  const handleAddNew = () => {
    if (newContent.trim()) {
      const newSection: Section = {
        id: `new-${Date.now()}`,
        title: "",
        content: newContent.trim(),
      }
      setSections((prev) => [...prev, newSection])
      setNewContent("")
      setIsAddingNew(false)
    }
  }

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg text-primary">审核结果</CardTitle>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                复制
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" />
            导出PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadExcel}
            className="gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" />
            导出Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadWord}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" />
            导出Word
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {sections.map((section) => (
            <div
              key={section.id}
              className="group relative"
            >
              {editingId === section.id ? (
                // 编辑模式
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[150px] font-mono text-sm"
                    placeholder="请输入内容..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      取消
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      保存
                    </Button>
                  </div>
                </div>
              ) : (
                // 显示模式
                <>
                  {/* 操作按钮 - 悬停显示 */}
                  <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => handleEdit(section)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteClick(section.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* 区块内容 */}
                  <div className="max-w-none text-sm">
                    {isCompletenessSection(section) ? (
                      <CompletenessAuditPanel section={section} />
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={markdownPlugins}
                        components={markdownComponents}
                      >
                        {section.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* 添加新内容区域 */}
          {isAddingNew ? (
            <div className="space-y-2 pt-4 border-t">
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
                placeholder="请输入要添加的内容...&#10;&#10;提示：可以使用 ✅ ❌ ⚠️ ➖ 等图标"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddingNew(false)
                    setNewContent("")
                  }}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNew}
                  disabled={!newContent.trim()}
                >
                  添加
                </Button>
              </div>
            </div>
          ) : (
            // 添加按钮
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setIsAddingNew(true)}
              >
                <Plus className="h-4 w-4" />
                添加内容
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个区块吗？删除后将无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
