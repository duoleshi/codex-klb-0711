"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { History, Search, Trash2, Eye, ChevronLeft, ChevronRight, FileCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Header, Footer } from "@/components/landing"

interface ReviewRecord {
  id: string
  filename: string
  file_size: number | null
  profession_types: string | null
  review_conclusion: string | null
  knowledge_file: string | null
  tokens_used: number | null
  model: string | null
  user_id: string | null
  created_at: string
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// 专业类型选项（13 个专业 + 全部类型）
const PROFESSION_OPTIONS = [
  { value: "all", label: "全部类型" },
  { value: "基坑工程", label: "基坑工程" },
  { value: "模板支撑体系工程", label: "模板支撑体系工程" },
  { value: "起重吊装及拆卸工程", label: "起重吊装及拆卸工程" },
  { value: "脚手架工程", label: "脚手架工程" },
  { value: "拆除、爆破工程", label: "拆除、爆破工程" },
  { value: "暗挖工程", label: "暗挖工程" },
  { value: "建筑幕墙安装工程", label: "建筑幕墙安装工程" },
  { value: "人工挖孔桩工程", label: "人工挖孔桩工程" },
  { value: "钢结构安装工程", label: "钢结构安装工程" },
  { value: "水下作业工程", label: "水下作业工程" },
  { value: "装配式建筑混凝土预制构件安装工程", label: "装配式构件安装工程" },
  { value: "采用新技术、新工艺、新材料、新设备工程", label: "四新技术工程" },
  { value: "有限空间作业", label: "有限空间作业" },
]

// 结论颜色映射
const getConclusionColor = (conclusion: string | null) => {
  if (!conclusion) return "text-gray-500"
  if (conclusion === "合规") return "text-green-600"
  if (conclusion === "部分合规") return "text-yellow-600"
  if (conclusion === "不合规") return "text-red-600"
  return "text-gray-500"
}

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// 格式化模型名称
const formatModelName = (model: string | null) => {
  if (!model) return "-"
  if (model.includes("deepseek")) return "DeepSeek"
  if (model.includes("qwen")) return "通义千问"
  return model
}

// 格式化文件大小
const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function HistoryPage() {
  const router = useRouter()
  const [records, setRecords] = useState<ReviewRecord[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState("")
  const [professionType, setProfessionType] = useState("all")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // 获取历史记录
  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", pagination.page.toString())
      params.set("pageSize", pagination.pageSize.toString())
      if (keyword) params.set("keyword", keyword)
      if (professionType && professionType !== "all") params.set("professionType", professionType)

      const response = await fetch(`/api/history?${params}`)
      const data = await response.json()

      if (data.success) {
        setRecords(data.data.records)
        setPagination(prev => ({
          ...prev,
          ...data.data.pagination,
        }))
      }
    } catch (error) {
      console.error("获取历史记录失败:", error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.pageSize, keyword, professionType])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // 删除记录
  const handleDelete = async () => {
    if (!deleteId) return

    try {
      const response = await fetch(`/api/history?id=${deleteId}`, {
        method: "DELETE",
      })
      const data = await response.json()

      if (data.success) {
        fetchRecords()
      }
    } catch (error) {
      console.error("删除失败:", error)
    } finally {
      setDeleteId(null)
    }
  }

  // 搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchRecords()
  }

  // 翻页
  const goToPage = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="mx-auto max-w-[1200px] px-4">
          {/* 页面标题 */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5">
                <History className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">历史记录</span>
              </div>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-foreground md:text-3xl">
              审核历史记录
            </h1>
            <p className="mt-2 text-muted-foreground">
              查看和管理您的审核历史记录
            </p>
          </div>

        {/* 筛选区域 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="搜索文件名..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Select value={professionType} onValueChange={setProfessionType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="专业类型" />
                </SelectTrigger>
                <SelectContent>
                  {PROFESSION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" />
                搜索
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 记录列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>审核记录</span>
              <span className="text-sm font-normal text-muted-foreground">
                共 {pagination.total} 条记录
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">
                加载中...
              </div>
            ) : records.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileCheck className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>暂无审核记录</p>
                <Link href="/">
                  <Button variant="link" className="mt-2">
                    去上传文件审核
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3 font-medium">序号</th>
                        <th className="pb-3 font-medium">文件名</th>
                        <th className="pb-3 font-medium">专业类型</th>
                        <th className="pb-3 font-medium">审核模型</th>
                        <th className="pb-3 font-medium">审核结论</th>
                        <th className="pb-3 font-medium">审核时间</th>
                        <th className="pb-3 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, index) => (
                        <tr
                          key={record.id}
                          className="border-b last:border-0 hover:bg-muted/50"
                        >
                          <td className="py-4 text-sm">
                            {(pagination.page - 1) * pagination.pageSize + index + 1}
                          </td>
                          <td className="py-4 max-w-[220px]">
                            <div className="font-medium break-all">{record.filename}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatFileSize(record.file_size)}
                            </div>
                          </td>
                          <td className="py-4 text-sm max-w-[220px] break-all">
                            {record.profession_types
                              ? JSON.parse(record.profession_types).join("、")
                              : "通用工程"}
                          </td>
                          <td className="py-4 text-sm min-w-[80px]">
                            {formatModelName(record.model)}
                          </td>
                          <td className="py-4">
                            <span className={`font-medium ${getConclusionColor(record.review_conclusion)}`}>
                              {record.review_conclusion || "待确认"}
                            </span>
                          </td>
                          <td className="py-4 text-sm text-muted-foreground">
                            {formatDate(record.created_at)}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Link href={`/history/${record.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="mr-1 h-3 w-3" />
                                  查看
                                </Button>
                              </Link>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={() => setDeleteId(record.id)}
                                  >
                                    <Trash2 className="mr-1 h-3 w-3" />
                                    删除
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>确认删除</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      确定要删除这条审核记录吗？此操作不可撤销。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={handleDelete}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      确认删除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 分页 */}
                {pagination.totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      第 {pagination.page} / {pagination.totalPages} 页
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page <= 1}
                        onClick={() => goToPage(pagination.page - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => goToPage(pagination.page + 1)}
                      >
                        下一页
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </main>
      <Footer />
    </div>
  )
}
