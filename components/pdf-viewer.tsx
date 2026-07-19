"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// 动态导入 react-pdf 组件，禁用 SSR
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  }
)

const Page = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
)

interface PdfViewerProps {
  open: boolean
  onClose: () => void
  fileUrl: string
  fileName: string
  onDownload?: () => void
}

export function PdfViewer({ open, onClose, fileUrl, fileName, onDownload }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [loading, setLoading] = useState<boolean>(true)
  const [workerReady, setWorkerReady] = useState<boolean>(false)

  // 设置 PDF.js worker
  useEffect(() => {
    import("react-pdf").then(({ pdfjs }) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
      setWorkerReady(true)
    })
  }, [])

  useEffect(() => {
    if (open) {
      setPageNumber(1)
      setScale(1.0)
      setLoading(true)
    }
  }, [open, fileUrl])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF 加载失败:", error)
    setLoading(false)
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages))
  }

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.0))
  }

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5))
  }

  if (!workerReady) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">{fileName}</DialogTitle>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPrevPage} disabled={pageNumber <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[100px] text-center">
              {pageNumber} / {numPages || "?"} 页
            </span>
            <Button variant="outline" size="sm" onClick={goToNextPage} disabled={pageNumber >= numPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={zoomOut} disabled={scale <= 0.5}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={zoomIn} disabled={scale >= 2.0}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              下载原文
            </Button>
          )}
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg flex items-start justify-center p-4">
          {loading && (
            <div className="absolute flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">加载中...</p>
            </div>
          )}
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              className="shadow-lg"
            />
          </Document>
        </div>
      </DialogContent>
    </Dialog>
  )
}
