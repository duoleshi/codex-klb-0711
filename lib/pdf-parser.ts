// ./lib/pdf-parser.ts

/**
 * 解析 PDF 文件内容
 * 1. 先尝试文本提取（pdf-parse）
 * 2. 如果失败或内容太少，使用 OCR 识别
 *    OCR 优先级：
 *    - MinerU API（主）：200MB 以内，识别质量最高，支持表格/公式
 *    - 百度 OCR（备）：2MB 以内，快速备用
 *    - Tesseract.js（兜底）：大文件或网络问题时使用
 */

import path from "path"
import pdfParse from "pdf-parse"
import Tesseract from "tesseract.js"

// 进度回调类型
export interface ProgressCallback {
  (progress: {
    stage: string        // 当前阶段
    message: string      // 描述信息
    current?: number     // 当前进度
    total?: number       // 总数
    percent?: number     // 百分比 (0-100)
  }): void
}

// 动态导入 pdf-to-img，避免构建时的问题
let pdfToImg: any = null

async function getPdfToImg() {
  if (!pdfToImg) {
    // 设置 pdf.js worker 路径（使用 .mjs 格式）
    const pdfjsDist = await import("pdfjs-dist")
    // 使用 file:// 协议的绝对路径
    const workerPath = path.join(
      process.cwd(),
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    )
    pdfjsDist.GlobalWorkerOptions.workerSrc = `file://${workerPath}`

    const module = await import("pdf-to-img")
    pdfToImg = module.pdf
  }
  return pdfToImg
}

// 空页阈值：少于这个字符数的页面视为空页/扫描页
const EMPTY_PAGE_THRESHOLD = 50

// OCR 触发阈值：如果文本提取少于这个字符数，启用 OCR
const OCR_THRESHOLD = 100

// 百度 OCR 文件大小限制（2MB，百度对 PDF 的实际限制比官方说明更严格）
const BAIDU_OCR_SIZE_LIMIT = 2 * 1024 * 1024

// 百度 OCR 配置
const BAIDU_OCR_API_KEY = process.env.BAIDU_OCR_API_KEY || ""
const BAIDU_OCR_SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY || ""

// MinerU API 配置（用于扫描版 PDF，支持 200MB 以内文件）
const MINERU_API_TOKEN = process.env.MINERU_API_TOKEN || ""
const MINERU_API_BASE = "https://mineru.net/api/v4"
const MINERU_SIZE_LIMIT = 200 * 1024 * 1024 // 200MB

// Pix2Text (P2T) API 配置
const P2T_API_KEY = process.env.P2T_API_KEY || ""
const P2T_API_BASE = "https://api.breezedeus.com"

// TextIn xParse API 配置
const TEXTIN_APP_ID = process.env.TEXTIN_APP_ID || ""
const TEXTIN_SECRET_CODE = process.env.TEXTIN_SECRET_CODE || ""

// Access Token 缓存
let cachedAccessToken: string | null = null
let tokenExpireTime: number = 0

// Tesseract worker 缓存
let tesseractWorker: Tesseract.Worker | null = null

/**
 * 获取百度 OCR Access Token
 */
async function getBaiduAccessToken(): Promise<string> {
  // 如果有缓存的 token 且未过期，直接返回
  if (cachedAccessToken && Date.now() < tokenExpireTime) {
    return cachedAccessToken
  }

  const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_OCR_API_KEY}&client_secret=${BAIDU_OCR_SECRET_KEY}`

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`获取百度 Access Token 失败: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`百度 OAuth 错误: ${data.error_description || data.error}`)
  }

  // 缓存 token（提前 5 分钟过期）
  cachedAccessToken = data.access_token
  tokenExpireTime = Date.now() + (data.expires_in - 300) * 1000

  console.log(`[百度OCR] 获取 Access Token 成功，有效期 ${Math.floor(data.expires_in / 3600)} 小时`)

  return cachedAccessToken!
}

/**
 * 使用 pdf-parse 尝试文本提取
 */
async function extractTextWithPdfParse(buffer: Buffer): Promise<{
  text: string
  numpages: number
  pageDetails: { pageNum: number; charCount: number }[]
}> {
  const pageDetails: { pageNum: number; charCount: number }[] = []
  let currentPageNum = 0

  const renderPage = (pageData: any) => {
    currentPageNum++
    return pageData.getTextContent().then((textContent: any) => {
      const items = textContent.items || []
      const pageText = items
        .map((item: any) => item.str || "")
        .join(" ")
        .trim()

      pageDetails.push({
        pageNum: currentPageNum,
        charCount: pageText.length,
      })

      return ""
    })
  }

  const data = await pdfParse(buffer, { pagerender: renderPage })

  // 重新提取完整文本
  const fullData = await pdfParse(buffer)
  const text = fullData.text.trim()

  return { text, numpages: data.numpages, pageDetails }
}

/**
 * 使用百度 OCR 识别 PDF
 * 使用通用文字识别 API，支持 PDF 格式
 */
export async function recognizeWithBaiduOCR(buffer: Buffer): Promise<string> {
  console.log(`[百度OCR] 开始识别 PDF...`)

  if (!BAIDU_OCR_API_KEY || !BAIDU_OCR_SECRET_KEY) {
    console.warn(`[百度OCR] 未配置 API Key，跳过`)
    throw new Error("百度 OCR 未配置 API Key")
  }

  // 检查文件大小
  if (buffer.length > BAIDU_OCR_SIZE_LIMIT) {
    console.log(`[百度OCR] 文件过大 (${(buffer.length / 1024 / 1024).toFixed(2)} MB > 10MB)，跳过百度 OCR`)
    throw new Error("文件大小超过百度 OCR 限制")
  }

  try {
    // 获取 Access Token
    const accessToken = await getBaiduAccessToken()

    // 将 PDF 转为 base64
    const pdfBase64 = buffer.toString("base64")

    // 尝试使用通用文字识别 API（高精度版）
    // 该 API 支持 PDF 文件
    const ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`

    const formData = new URLSearchParams()
    formData.append("pdf_file", pdfBase64)

    console.log(`[百度OCR] 正在识别 PDF（文件大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB）...`)

    const response = await fetch(ocrUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    })

    const result = await response.json()

    // 如果返回错误
    if (result.error_code) {
      // PDF 接口不支持，尝试使用标准版
      if (result.error_code === 216202 || result.error_code === 3) {
        console.log(`[百度OCR] 高精度版不支持 PDF，尝试标准版...`)
        return await recognizeWithStandardOCR(buffer, accessToken)
      }
      throw new Error(`百度 OCR 错误: ${result.error_msg} (${result.error_code})`)
    }

    // 提取识别结果
    let fullText = ""
    if (result.words_result && Array.isArray(result.words_result)) {
      fullText = result.words_result.map((w: any) => w.words || "").join("\n")
    }

    console.log(`[百度OCR] 识别完成: ${fullText.length} 字符`)

    return fullText.trim()
  } catch (error) {
    console.error(`[百度OCR] 识别失败:`, error)
    throw error
  }
}

/**
 * 使用标准版 OCR（备用方案）
 */
async function recognizeWithStandardOCR(buffer: Buffer, accessToken: string): Promise<string> {
  const ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${accessToken}`

  const pdfBase64 = buffer.toString("base64")

  const formData = new URLSearchParams()
  formData.append("pdf_file", pdfBase64)

  const response = await fetch(ocrUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  })

  const result = await response.json()

  if (result.error_code) {
    throw new Error(`百度标准 OCR 错误: ${result.error_msg} (${result.error_code})`)
  }

  let fullText = ""
  if (result.words_result && Array.isArray(result.words_result)) {
    fullText = result.words_result.map((w: any) => w.words || "").join("\n")
  }

  console.log(`[百度OCR] 标准版识别完成: ${fullText.length} 字符`)

  return fullText.trim()
}

/**
 * 使用 MinerU API 识别 PDF（推荐，支持 200MB 以内文件）
 * 流程：申请上传链接 → 上传文件 → 轮询结果 → 下载 Markdown
 */
export async function recognizeWithMinerU(
  buffer: Buffer,
  filename: string = "document.pdf",
  onProgress?: ProgressCallback
): Promise<string> {
  console.log(`[MinerU] 开始解析 PDF...`)
  console.log(`[MinerU] 文件大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

  if (!MINERU_API_TOKEN) {
    throw new Error("MinerU API Token 未配置")
  }

  if (buffer.length > MINERU_SIZE_LIMIT) {
    throw new Error(`文件大小超过 MinerU 限制 (200MB)`)
  }

  try {
    // 1. 申请上传链接
    onProgress?.({ stage: "pdf_ocr", message: "正在申请上传链接..." })
    console.log(`[MinerU] 步骤1: 申请上传链接...`)
    const batchRes = await fetch(`${MINERU_API_BASE}/file-urls/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MINERU_API_TOKEN}`
      },
      body: JSON.stringify({
        files: [{ name: filename }],
        model_version: "vlm",  // 使用 VLM 模型，识别效果最好
        is_ocr: true,          // 启用 OCR
        enable_formula: true,  // 启用公式识别
        enable_table: true,    // 启用表格识别
        language: "ch"         // 中文
      })
    })

    if (!batchRes.ok) {
      const errorText = await batchRes.text()
      throw new Error(`申请上传链接失败: ${batchRes.status} - ${errorText}`)
    }

    const batchData = await batchRes.json()

    if (batchData.code !== 0) {
      throw new Error(`MinerU API 错误: ${batchData.msg}`)
    }

    const { batch_id, file_urls } = batchData.data
    console.log(`[MinerU] 获取上传链接成功，batch_id: ${batch_id}`)

    // 2. 上传文件
    onProgress?.({ stage: "pdf_ocr", message: "正在上传文件到 OCR 服务器..." })
    console.log(`[MinerU] 步骤2: 上传文件...`)
    const uploadRes = await fetch(file_urls[0], {
      method: "PUT",
      body: buffer
    })

    if (!uploadRes.ok) {
      throw new Error(`上传文件失败: ${uploadRes.status}`)
    }

    console.log(`[MinerU] 文件上传成功，等待解析...`)

    // 3. 轮询结果（最多等待 5 分钟，每 5 秒检查一次）
    const maxRetries = 60
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000))

      const resultRes = await fetch(
        `${MINERU_API_BASE}/extract-results/batch/${batch_id}`,
        {
          headers: {
            "Authorization": `Bearer ${MINERU_API_TOKEN}`
          }
        }
      )

      if (!resultRes.ok) {
        console.warn(`[MinerU] 查询结果失败: ${resultRes.status}`)
        continue
      }

      const result = await resultRes.json()
      const extractResult = result.data?.extract_result?.[0]

      if (!extractResult) {
        console.log(`[MinerU] 等待中... (${i + 1}/${maxRetries})`)
        continue
      }

      const state = extractResult.state
      console.log(`[MinerU] 状态: ${state} (${i + 1}/${maxRetries})`)

      if (state === "done") {
        // 4. 下载并解析结果
        onProgress?.({ stage: "pdf_ocr", message: "正在下载解析结果..." })
        console.log(`[MinerU] 步骤3: 下载解析结果...`)
        const fullZipUrl = extractResult.full_zip_url

        if (!fullZipUrl) {
          throw new Error("MinerU 返回结果中没有下载链接")
        }

        // 下载 ZIP 文件
        const zipRes = await fetch(fullZipUrl)
        if (!zipRes.ok) {
          throw new Error(`下载结果失败: ${zipRes.status}`)
        }

        const zipBuffer = Buffer.from(await zipRes.arrayBuffer())

        // 解析 ZIP 中的 Markdown 文件
        const markdown = await extractMarkdownFromZip(zipBuffer)
        console.log(`[MinerU] 解析完成: ${markdown.length} 字符`)

        return markdown
      }

      if (state === "failed") {
        throw new Error(`MinerU 解析失败: ${extractResult.err_msg || "未知错误"}`)
      }

      // 显示进度
      if (state === "running" && extractResult.extract_progress) {
        const { extracted_pages, total_pages } = extractResult.extract_progress
        const percent = Math.round((extracted_pages / total_pages) * 100)
        console.log(`[MinerU] 正在解析: ${extracted_pages}/${total_pages} 页`)
        onProgress?.({
          stage: "pdf_ocr",
          message: `OCR 识别中: ${extracted_pages}/${total_pages} 页`,
          current: extracted_pages,
          total: total_pages,
          percent
        })
      }
    }

    throw new Error("MinerU 解析超时（超过 5 分钟）")
  } catch (error) {
    console.error(`[MinerU] 识别失败:`, error)
    throw error
  }
}

/**
 * 从 MinerU 返回的 ZIP 文件中提取 Markdown 内容
 */
async function extractMarkdownFromZip(zipBuffer: Buffer): Promise<string> {
  // 使用动态导入避免构建问题
  const JSZip = (await import("jszip")).default

  const zip = await JSZip.loadAsync(zipBuffer)

  // 查找 markdown 文件（通常在根目录或子目录中）
  let markdownContent = ""
  const mdFiles: string[] = []

  // 遍历 ZIP 文件中的所有文件
  zip.forEach((relativePath, file) => {
    if (relativePath.endsWith(".md") && !relativePath.startsWith("__MACOSX")) {
      mdFiles.push(relativePath)
    }
  })

  if (mdFiles.length === 0) {
    // 如果没有 markdown，尝试读取 JSON 文件
    const jsonFiles: string[] = []
    zip.forEach((relativePath, file) => {
      if (relativePath.endsWith(".json") && !relativePath.startsWith("__MACOSX")) {
        jsonFiles.push(relativePath)
      }
    })

    if (jsonFiles.length > 0) {
      // 读取 JSON 文件并提取文本
      for (const jsonFile of jsonFiles) {
        const content = await zip.file(jsonFile)?.async("string")
        if (content) {
          try {
            const jsonData = JSON.parse(content)
            // 尝试从 JSON 中提取文本
            if (jsonData.text) {
              markdownContent += jsonData.text + "\n"
            } else if (Array.isArray(jsonData.pages)) {
              for (const page of jsonData.pages) {
                if (page.text) {
                  markdownContent += page.text + "\n"
                } else if (page.blocks) {
                  for (const block of page.blocks) {
                    if (block.text) {
                      markdownContent += block.text + "\n"
                    }
                  }
                }
              }
            }
          } catch {
            // JSON 解析失败，直接使用原始内容
            markdownContent += content + "\n"
          }
        }
      }
    }
  } else {
    // 读取所有 markdown 文件
    for (const mdFile of mdFiles.sort()) {
      const content = await zip.file(mdFile)?.async("string")
      if (content) {
        markdownContent += content + "\n\n"
      }
    }
  }

  if (!markdownContent.trim()) {
    throw new Error("无法从 ZIP 文件中提取文本内容")
  }

  return markdownContent.trim()
}

/**
 * 使用 Tesseract.js 本地 OCR 识别 PDF
 * 将 PDF 转为图片后逐页识别
 */
export async function recognizeWithTesseract(buffer: Buffer): Promise<string> {
  console.log(`[Tesseract] 开始本地 OCR 识别...`)
  console.log(`[Tesseract] PDF 大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

  try {
    // 初始化 worker（只初始化一次）
    if (!tesseractWorker) {
      console.log(`[Tesseract] 初始化中文识别引擎...`)

      // 使用绝对路径解决 Next.js Turbopack 路径问题
      const workerPath = path.join(
        process.cwd(),
        "node_modules/tesseract.js/src/worker-script/node/index.js"
      )

      tesseractWorker = await Tesseract.createWorker("chi_sim+eng", 1, {
        logger: (m) => {
          if (m.status === "loading tesseract core") {
            console.log(`[Tesseract] 加载核心...`)
          } else if (m.status === "initializing tesseract") {
            console.log(`[Tesseract] 初始化...`)
          } else if (m.status === "loading language traineddata") {
            console.log(`[Tesseract] 加载中文语言包...`)
          }
        },
        workerPath,
      })
      console.log(`[Tesseract] 初始化完成`)
    }

    // 将 PDF 转换为图片
    console.log(`[Tesseract] 正在将 PDF 转换为图片...`)

    // 动态获取 pdf-to-img 并配置 worker
    const pdf = await getPdfToImg()

    const pdfDoc = await pdf(buffer, {
      scale: 2, // 提高分辨率以获得更好的 OCR 效果
    })

    // 获取总页数（pdfDoc.length 返回页数）
    const totalPages = pdfDoc.length
    console.log(`[Tesseract] PDF 共 ${totalPages} 页`)

    let fullText = ""
    let pageNum = 0

    // 逐页处理
    for await (const pageImage of pdfDoc) {
      pageNum++
      console.log(`[Tesseract] 正在识别第 ${pageNum}/${totalPages} 页...`)

      // 将图片转为 Buffer
      const imageBuffer = Buffer.from(pageImage)

      // 使用 Tesseract 识别
      const { data } = await tesseractWorker.recognize(imageBuffer)
      const pageText = data.text.trim()

      if (pageText) {
        fullText += pageText + "\n\n"
      }

      console.log(`[Tesseract] 第 ${pageNum} 页完成，识别 ${pageText.length} 字符`)
    }

    console.log(`[Tesseract] 全部完成，共识别 ${fullText.length} 字符`)

    return fullText.trim()
  } catch (error) {
    console.error(`[Tesseract] 识别失败:`, error)
    throw error
  }
}

/**
 * 使用 Pix2Text (P2T) Cloud API 识别 PDF/图片
 * 流程：提交任务 → 获取 task_id → 轮询结果
 * PDF 文件必须使用 server_type: 'ultra'
 */
export async function recognizeWithP2T(
  buffer: Buffer,
  filename: string = "document.pdf"
): Promise<string> {
  console.log(`[P2T] 开始识别...`)
  console.log(`[P2T] 文件大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

  if (!P2T_API_KEY) {
    throw new Error("P2T API Key 未配置")
  }

  const isPDF = filename.toLowerCase().endsWith(".pdf")

  try {
    // 1. 提交识别任务
    const formData = new FormData()
    const blob = new Blob([buffer], { type: isPDF ? "application/pdf" : "image/png" })
    formData.append("image", blob, filename)
    formData.append("language", "zh")
    formData.append("file_type", "text_formula")
    formData.append("server_type", isPDF ? "ultra" : "pro")
    formData.append("resized_shape", "608")

    console.log(`[P2T] 提交任务 (server_type: ${isPDF ? "ultra" : "pro"})...`)

    const submitRes = await fetch(`${P2T_API_BASE}/pix2text`, {
      method: "POST",
      headers: {
        "X-API-Key": P2T_API_KEY,
      },
      body: formData,
    })

    if (!submitRes.ok) {
      const errorText = await submitRes.text()
      throw new Error(`P2T 提交失败: ${submitRes.status} - ${errorText}`)
    }

    const submitData = await submitRes.json()

    if (submitData.code !== 200 && submitData.status !== "success") {
      throw new Error(`P2T API 错误: ${submitData.message || submitData.msg || JSON.stringify(submitData)}`)
    }

    const taskId = submitData.data?.task_id || submitData.task_id
    if (!taskId) {
      throw new Error(`P2T 未返回 task_id: ${JSON.stringify(submitData)}`)
    }

    console.log(`[P2T] 任务提交成功，task_id: ${taskId}`)

    // 如果同步返回了结果，直接使用
    if (submitData.data?.result) {
      const text = extractP2TResult(submitData.data.result)
      if (text) {
        console.log(`[P2T] 同步返回结果: ${text.length} 字符`)
        return text
      }
    }

    // 2. 轮询结果（最多等待 5 分钟，每 3 秒检查一次）
    const maxRetries = 100
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000))

      const pollRes = await fetch(`${P2T_API_BASE}/result/${taskId}`, {
        headers: {
          "X-API-Key": P2T_API_KEY,
        },
      })

      if (!pollRes.ok) {
        console.warn(`[P2T] 轮询失败: ${pollRes.status}`)
        continue
      }

      const pollData = await pollRes.json()
      const status = pollData.data?.status || pollData.status
      console.log(`[P2T] 状态: ${status} (${i + 1}/${maxRetries})`)

      if (status === "FINISHED" || status === "finished" || status === "done") {
        const result = pollData.data?.result || pollData.result
        const text = extractP2TResult(result)
        console.log(`[P2T] 识别完成: ${text.length} 字符`)
        return text
      }

      if (status === "FAILED" || status === "failed" || status === "error") {
        throw new Error(`P2T 识别失败: ${pollData.data?.error || pollData.message || "未知错误"}`)
      }

      // PROGRESS 状态，继续轮询
    }

    throw new Error("P2T 识别超时（超过 5 分钟）")
  } catch (error) {
    console.error(`[P2T] 识别失败:`, error)
    throw error
  }
}

/**
 * 从 P2T 返回结果中提取文本
 */
function extractP2TResult(result: any): string {
  if (!result) return ""

  // 如果结果是字符串
  if (typeof result === "string") return result

  // 如果结果是数组（每个元素是识别的文本块）
  if (Array.isArray(result)) {
    return result.map((item: any) => {
      if (typeof item === "string") return item
      if (item.text) return item.text
      return ""
    }).join("\n")
  }

  // 如果结果是对象
  if (result.text) return result.text
  if (result.markdown) return result.markdown
  if (result.content) return result.content

  return JSON.stringify(result)
}

/**
 * 使用 TextIn xParse API 识别 PDF
 * 同步调用，直接返回 Markdown
 */
export async function recognizeWithTextIn(
  buffer: Buffer
): Promise<string> {
  console.log(`[TextIn] 开始识别 PDF...`)
  console.log(`[TextIn] 文件大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

  if (!TEXTIN_APP_ID || !TEXTIN_SECRET_CODE) {
    throw new Error("TextIn API 凭证未配置")
  }

  try {
    const formData = new FormData()
    const blob = new Blob([buffer], { type: "application/pdf" })
    formData.append("file", blob, "document.pdf")
    formData.append("parse_mode", "auto")
    formData.append("table_flavor", "html")
    formData.append("formula_level", "0")

    console.log(`[TextIn] 提交识别请求...`)

    const response = await fetch("https://api.textin.com/ai/service/v1/pdf_to_markdown", {
      method: "POST",
      headers: {
        "x-ti-app-id": TEXTIN_APP_ID,
        "x-ti-secret-code": TEXTIN_SECRET_CODE,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TextIn 请求失败: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    if (data.code !== 200 && data.code !== 0) {
      throw new Error(`TextIn API 错误: ${data.message || data.msg || JSON.stringify(data)}`)
    }

    const markdown = data.result?.markdown || data.result?.text || ""

    if (!markdown.trim()) {
      throw new Error("TextIn 返回结果为空")
    }

    console.log(`[TextIn] 识别完成: ${markdown.length} 字符`)

    return markdown.trim()
  } catch (error) {
    console.error(`[TextIn] 识别失败:`, error)
    throw error
  }
}

/**
 * 解析 PDF 文件
 */
export async function parsePDF(buffer: Buffer, onProgress?: ProgressCallback): Promise<string> {
  try {
    console.log(`开始解析 PDF, buffer 大小: ${buffer.length} bytes`)

    // 第一步：尝试文本提取
    onProgress?.({ stage: "pdf_parse", message: "正在提取 PDF 文本...", percent: 5 })
    let text = ""
    let numpages = 0
    let pageDetails: { pageNum: number; charCount: number }[] = []

    try {
      const result = await extractTextWithPdfParse(buffer)
      text = result.text
      numpages = result.numpages
      pageDetails = result.pageDetails
      console.log(`[文本提取] 完成: ${text.length} 字符, ${numpages} 页`)

      // 输出每页详情
      const emptyPages = pageDetails.filter((p) => p.charCount < EMPTY_PAGE_THRESHOLD)
      const validPages = pageDetails.filter((p) => p.charCount >= EMPTY_PAGE_THRESHOLD)
      console.log(`[文本提取] 有效页面: ${validPages.length} 页, 空页/扫描页: ${emptyPages.length} 页`)
    } catch (e) {
      console.warn(`[文本提取] 失败: ${e instanceof Error ? e.message : e}`)
    }

    // 第二步：如果文本提取太少，启用 OCR
    // OCR 优先级：MinerU（主，200MB以内）→ 百度OCR（备，2MB以内）→ Tesseract（兜底）
    if (text.length < OCR_THRESHOLD) {
      console.log(`[文本提取] 内容过少 (${text.length} 字符)，启用 OCR 识别...`)

      const fileSizeMB = buffer.length / 1024 / 1024
      const canUseMinerU = buffer.length <= MINERU_SIZE_LIMIT && MINERU_API_TOKEN
      const canUseBaidu = buffer.length <= BAIDU_OCR_SIZE_LIMIT && BAIDU_OCR_API_KEY && BAIDU_OCR_SECRET_KEY

      // 1. 优先使用 MinerU（200MB 以内）
      if (canUseMinerU) {
        console.log(`[OCR] 文件大小 ${fileSizeMB.toFixed(2)} MB，优先使用 MinerU API...`)

        try {
          const mineruText = await recognizeWithMinerU(buffer, "document.pdf", onProgress)
          if (mineruText.length > text.length) {
            text = mineruText
            console.log(`[MinerU] 使用 MinerU 结果: ${text.length} 字符`)
          }
        } catch (mineruError) {
          console.warn(`[MinerU] 失败:`, mineruError instanceof Error ? mineruError.message : mineruError)

          // 2. MinerU 失败，尝试百度 OCR（仅限小文件）
          if (canUseBaidu) {
            console.log(`[OCR] 降级到百度 OCR...`)
            onProgress?.({ stage: "pdf_ocr", message: "正在使用百度 OCR..." })
            try {
              const baiduText = await recognizeWithBaiduOCR(buffer)
              if (baiduText.length > text.length) {
                text = baiduText
                console.log(`[百度OCR] 使用百度 OCR 结果: ${text.length} 字符`)
              }
            } catch (baiduError) {
              console.warn(`[百度OCR] 失败:`, baiduError instanceof Error ? baiduError.message : baiduError)
            }
          }

          // 3. 如果百度也失败或不可用，尝试 Tesseract
          if (text.length < OCR_THRESHOLD) {
            console.log(`[OCR] 尝试 Tesseract.js 本地 OCR...`)
            onProgress?.({ stage: "pdf_ocr", message: "正在使用本地 OCR..." })
            try {
              const tesseractText = await recognizeWithTesseract(buffer)
              if (tesseractText.length > text.length) {
                text = tesseractText
                console.log(`[Tesseract] 使用 Tesseract 结果: ${text.length} 字符`)
              }
            } catch (tesseractError) {
              console.error(`[Tesseract] 识别失败:`, tesseractError instanceof Error ? tesseractError.message : tesseractError)
            }
          }
        }
      } else if (canUseBaidu) {
        // MinerU 不可用（文件太大或未配置），使用百度 OCR
        console.log(`[OCR] MinerU 不可用，使用百度 OCR...`)
        onProgress?.({ stage: "pdf_ocr", message: "正在使用百度 OCR..." })

        try {
          const baiduText = await recognizeWithBaiduOCR(buffer)
          if (baiduText.length > text.length) {
            text = baiduText
            console.log(`[百度OCR] 使用百度 OCR 结果: ${text.length} 字符`)
          }
        } catch (baiduError) {
          console.warn(`[百度OCR] 失败，尝试 Tesseract.js:`, baiduError instanceof Error ? baiduError.message : baiduError)
          onProgress?.({ stage: "pdf_ocr", message: "正在使用本地 OCR..." })

          try {
            const tesseractText = await recognizeWithTesseract(buffer)
            if (tesseractText.length > text.length) {
              text = tesseractText
              console.log(`[Tesseract] 使用 Tesseract 结果: ${text.length} 字符`)
            }
          } catch (tesseractError) {
            console.error(`[Tesseract] 也失败了:`, tesseractError instanceof Error ? tesseractError.message : tesseractError)
          }
        }
      } else {
        // MinerU 和百度都不可用，直接使用 Tesseract
        console.log(`[OCR] 云服务不可用，直接使用 Tesseract.js...`)
        onProgress?.({ stage: "pdf_ocr", message: "正在使用本地 OCR..." })

        try {
          const tesseractText = await recognizeWithTesseract(buffer)
          if (tesseractText.length > text.length) {
            text = tesseractText
            console.log(`[Tesseract] 使用 Tesseract 结果: ${text.length} 字符`)
          }
        } catch (tesseractError) {
          console.error(`[Tesseract] 识别失败:`, tesseractError instanceof Error ? tesseractError.message : tesseractError)
        }
      }
    }

    console.log(`PDF 最终解析结果: ${text.length} 字符`)
    onProgress?.({ stage: "pdf_done", message: "PDF 解析完成", percent: 100 })

    if (text.length === 0) {
      console.warn("警告: PDF 解析后文本为空")
    }

    return text
  } catch (error) {
    console.error("PDF 解析详细错误:", error)
    throw new Error(`PDF 文件解析失败: ${error instanceof Error ? error.message : "未知错误"}`)
  }
}

/**
 * 嗅探 Office 文件真实格式（按文件头魔数，不依赖后缀）。
 * - OLE/CFBF（老式 .doc/.xls/.ppt）：D0 CF 11 E0 A1 B1 1A E1
 * - ZIP（.docx/.xlsx/.pptx，本质是 OOXML 压缩包）：50 4B 03 04
 * 这样即便用户把 .docx 改名成 .doc（或反之），也能正确路由到对应解析器。
 */
function sniffOfficeFormat(buffer: Buffer): "ole" | "zip" | "unknown" {
  if (!buffer || buffer.length < 8) return "unknown"
  // OLE2 复合文档签名
  if (
    buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 &&
    buffer[3] === 0xe0 && buffer[4] === 0xa1 && buffer[5] === 0xb1 &&
    buffer[6] === 0x1a && buffer[7] === 0xe1
  ) {
    return "ole"
  }
  // ZIP 签名（PK\x03\x04）
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "zip"
  }
  return "unknown"
}

/**
 * 解析老式 DOC 文件（Word 97-2003，OLE/CFBF 二进制格式）。
 * mammoth 只支持 .docx（OOXML/zip），遇到 .doc 会报
 * "Can't find end of central directory"，因此老式 .doc 必须走 word-extractor。
 */
async function parseDOC(buffer: Buffer): Promise<string> {
  const WordExtractor = (await import("word-extractor")).default
  const extractor = new WordExtractor()

  try {
    const doc = await extractor.extract(buffer)
    const parts: string[] = []
    // 正文
    const body = doc.getBody ? doc.getBody() : ""
    if (body) parts.push(body)
    // 页眉页脚里有时也有关键技术参数，一并带上
    try {
      const headers = doc.getHeaders ? doc.getHeaders() : ""
      if (headers) parts.push(headers)
    } catch {
      /* 部分文档没有页眉，忽略 */
    }

    const text = parts.join("\n").trim()
    if (!text) {
      throw new Error("DOC 文件内容为空（可能是扫描件，需要 OCR）")
    }

    console.log(`DOC 解析完成: ${text.length} 字符`)
    return text
  } catch (error) {
    console.error("DOC 解析失败:", error)
    throw new Error(`DOC 文件解析失败: ${error instanceof Error ? error.message : "未知错误"}`)
  }
}

/**
 * 解析 DOCX 文件（OOXML/zip 格式）
 */
async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth")

  try {
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value

    if (!text || text.trim().length === 0) {
      throw new Error("DOCX 文件内容为空")
    }

    console.log(`DOCX 解析完成: ${text.length} 字符`)
    return text
  } catch (error) {
    console.error("DOCX 解析失败:", error)
    throw new Error(`DOCX 文件解析失败: ${error instanceof Error ? error.message : "未知错误"}`)
  }
}

/**
 * 解析上传的文件（支持 PDF、DOCX、TXT、MD）
 */
export async function parseUploadedFile(
  buffer: Buffer,
  filename: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop()

  switch (ext) {
    case "pdf":
      return parsePDF(buffer, onProgress)

    case "docx":
    case "doc": {
      // 后缀不可全信（常见：.docx 被改名成 .doc，或反之）。
      // 按文件头魔数判断真实格式，路由到对应解析器：
      //   - zip（OOXML）→ mammoth（原 .docx 解析）
      //   - ole（CFBF） → word-extractor（老式 .doc）
      const realFmt = sniffOfficeFormat(buffer)
      if (realFmt === "ole") {
        onProgress?.({ stage: "doc_parse", message: "正在解析 DOC 文件（老式二进制格式）..." })
        return parseDOC(buffer)
      }
      if (realFmt === "zip") {
        onProgress?.({ stage: "docx_parse", message: "正在解析 DOCX 文件..." })
        return parseDOCX(buffer)
      }
      // 魔数都匹配不上：按后缀兜底，给出明确报错而非 jszip 的晦涩信息
      if (ext === "doc") {
        throw new Error(
          "无法识别的 DOC 文件格式（既不是标准 .doc 也不是 .docx）。请用 Word/WPS 打开后另存为 .docx 再上传。"
        )
      }
      throw new Error(
        "无法识别的 DOCX 文件格式（文件可能已损坏）。请用 Word/WPS 打开后另存为 .docx 再上传。"
      )
    }

    case "txt":
    case "md":
      return buffer.toString("utf-8")

    default:
      throw new Error(`不支持的文件格式: .${ext}，目前支持 PDF、DOCX、DOC、TXT、MD 格式`)
  }
}
