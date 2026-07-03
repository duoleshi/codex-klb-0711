import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { parseUploadedFile, ProgressCallback } from "@/lib/pdf-parser"
import {
  extractKnowledgeContext,
  getKnowledgeBaseInfo,
  ProfessionType,
  shouldUseChunkedReview,
  splitDocumentBySections,
  extractSimplifiedKnowledgeContext,
  identifyProfessionTypes,
  identifySchemeFeatures,
  DocumentChunk,
  CHUNK_CONFIG,
} from "@/lib/knowledge-base"
import { getClausesByFeatures, type MatchedClause } from "@/lib/clause-db"
import {
  saveReviewRecord,
  saveReviewRecordToSqlite,
  extractConclusion,
} from "@/lib/db"
import { getCurrentUserId } from "@/lib/supabase/server"

// 初始化 DeepSeek 客户端
const deepseekClient = new OpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
})

// 初始化千问百炼客户端
const qwenClient = new OpenAI({
  baseURL: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.QWEN_API_KEY,
})

// 根据模型选择获取对应的客户端和模型名
function getModelConfig(model: string) {
  if (model === "qwen") {
    return {
      client: qwenClient,
      modelName: process.env.QWEN_MODEL || "qwen-plus",
    }
  }
  return {
    client: deepseekClient,
    modelName: "deepseek-chat",
  }
}

// SSE 进度事件类型
interface ProgressEvent {
  type?: string
  stage: string
  message: string
  current?: number
  total?: number
  percent?: number
}

// 创建 SSE 编码器
function createSSEEncoder() {
  const encoder = new TextEncoder()
  return {
    encode: (event: ProgressEvent) => {
      return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
    },
    encodeResult: (data: any) => {
      return encoder.encode(`data: ${JSON.stringify({ type: "result", ...data })}\n\n`)
    },
    encodeError: (error: string) => {
      return encoder.encode(`data: ${JSON.stringify({ type: "error", error })}\n\n`)
    },
  }
}

/**
 * 构建审核提示词（硬编码模板，与 md 文件格式一致）
 */
function buildReviewPrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  loadedFilesCount: string,
  knowledgeContext: string,
  anchorClausesText: string,
  documentContent: string
): string {
  return `# 角色定位

你是一位经验丰富的施工方案审核专家，精通建筑施工规范。请根据用户上传的施工方案，对照提供的审核依据进行专业审核。

# 审核依据

以下是与你审核任务相关的知识库内容，请严格按照此依据进行审核：
---
${knowledgeContext.slice(0, 80000)}
---

# 精准条款锚点（本次审核必须优先逐条核对的核心条款）

以下条款是根据本方案的构造类型、涉及材料、关键工艺从规范中精准提取的核心条款原文，优先级高于上方通用知识库。审核时**必须逐条对照**：每条都要判断方案是否符合，并在报告里引用对应条款号与原文；方案违反任一条均须出具审核意见。

---
${anchorClausesText || "（本方案类型暂未配置锚点条款，按上方「审核依据」通用审核）"}
---

# 待审核内容
---
${documentContent}
---

# 审核输出格式（必须严格遵守以下格式）

请严格按照以下格式输出审核报告：

# ${filename}方案审核报告

## 1. 基本信息

**工程名称：** ${filename}

**专业类型：** ${professionNames}

**危大工程判定：** 根据方案内容判断是否危大工程（危险性较大工程、超过一定规模的危险性较大工程、一般专项方案）。

**审核依据：** 共加载 ${loadedFilesCount} 个规范文件

---

## 2. 通用性审核

（根据通用法律、法规、标准、规范审核，按1.法律2法规3标准和规范排序依次输出）

**审核意见1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制审核依据中的原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改建议）

**审核意见2：** ......

**审核意见3：** ......

---

## 3. 严重缺陷审核

（根据《住房城乡建设部办公厅关于印发《危险性较大的分部分项工程专项施工方案严重缺陷清单（试行）》的通知》检查是否存在缺漏项，如果存在请列出清单。）

---

## 4. 内容完整性审核

（以《危险性较大的分部分项工程专项施工方案编制指南》（建办质〔2021〕48号）为准审核）

---

## 5. 专业性审核

**审核意见1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制审核依据中的原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改建议）

**审核意见2：** ......

**审核意见3：** ..。。

---

## 6. 审核人员

| 角色 | 签字 | 日期 |
|------|------|------|
| 专业监理工程师 | | |
| 总监理工程师 | | |

---

# 问题分级标准

| 级别 | 定义 |
|-----|------|
| 严重问题 | 违反强制性条文、存在重大安全隐患、关键内容错误 |
| 一般问题 | 不符合一般性要求、表述不规范、内容不完整 |
| 缺失项 | 方案中应包含但未提及的内容 |
| 符合项 | 完全符合规范要求 |

# 强制要求

1. 严格依据提供的知识库内容进行审核，不得引用知识库以外的文件或标准。

2. 每条审核意见必须包含完整的四个要素：
   - 问题描述：清晰描述问题所在
   - 方案对应内容：准确引用方案原文
   - 依据：必须包含规范名称、条款编号、条款原文（三者缺一不可）
   - 整改要求/建议：具体可执行的整改建议

3. 通用性审核按法律→法规→标准规范的顺序输出。

4. 整改建议必须具体可执行，不得使用"建议完善"、"建议补充"等模糊表述。

5. 语言风格：专业、客观、准确。

6. 【禁止事项】以下行为严格禁止：
   - 禁止编造知识库中不存在的规范文件名称或编号
   - 禁止编造规范中不存在的条款号
   - 禁止修改、增减条款原文内容（如原文是"75°"不得写成"75°±5°"）
   - 禁止引用不提供条款原文的依据
   - 如无法在知识库中找到确切依据，宁可不提该问题，也不得编造
`
}

// 处理 OPTIONS 请求（CORS 预检）
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
  // 获取当前用户（可选，未登录也能审核）
  const userId = await getCurrentUserId()

  console.log("=== 开始审核请求 ===", userId ? `(用户: ${userId.slice(0, 8)}...)` : "(游客模式)")
  console.log("环境检查:", {
    nodeEnv: process.env.NODE_ENV,
    hasApiKey: !!process.env.DEEPSEEK_API_KEY,
    cwd: process.cwd(),
  })

  const encoder = createSSEEncoder()
  let abortController = new AbortController()

  // 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (event: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode({ type: "progress", ...event }))
        } catch (e) {
          // 流已关闭，忽略
        }
      }

      const sendResult = (data: any) => {
        try {
          controller.enqueue(encoder.encodeResult(data))
        } catch (e) {
          // 流已关闭，忽略
        }
      }

      const sendError = (error: string) => {
        try {
          controller.enqueue(encoder.encodeError(error))
        } catch (e) {
          // 流已关闭，忽略
        }
      }

      const close = () => {
        try {
          controller.close()
        } catch (e) {
          // 流已关闭，忽略
        }
      }

      try {
        // 解析表单数据
        const formData = await request.formData()
        const file = formData.get("file") as File | null
        const modelParam = (formData.get("model") as string) || "deepseek"

        if (!file) {
          sendError("请上传文件")
          close()
          return
        }

        const { client, modelName } = getModelConfig(modelParam)
        console.log(`使用模型: ${modelParam} (${modelName})`)

        console.log(`开始审核: ${file.name}, 文件大小: ${file.size} bytes`)

        // 1. 解析上传的文件
        sendProgress({ stage: "file_parse", message: "正在解析文件...", percent: 5 })
        const fileBuffer = Buffer.from(await file.arrayBuffer())

        // 创建进度回调
        const onParseProgress: ProgressCallback = (progress) => {
          sendProgress({
            stage: progress.stage,
            message: progress.message,
            current: progress.current,
            total: progress.total,
            percent: progress.percent ? Math.min(95, 5 + progress.percent * 0.9) : undefined,
          })
        }

        let documentContent: string
        try {
          documentContent = await parseUploadedFile(fileBuffer, file.name, onParseProgress)
          console.log(`文件解析成功: ${documentContent.length} 字符`)
        } catch (parseError) {
          console.error("文件解析失败:", parseError)
          sendError(`文件解析失败: ${parseError instanceof Error ? parseError.message : "未知错误"}`)
          close()
          return
        }

        if (!documentContent || documentContent.length < 100) {
          sendError("文件内容为空或太短，无法审核")
          close()
          return
        }

        // 2. 检测是否需要分块审核
        const chunkCheck = shouldUseChunkedReview(documentContent, file.size)
        console.log(`分块检测: ${chunkCheck.reason}`)

        if (chunkCheck.needsChunking) {
          // 分块审核流程
          await handleChunkedReviewSSE(file, documentContent, client, modelName, userId, sendProgress, sendResult, sendError, close)
          return
        }

        // 3. 提取知识库相关内容
        sendProgress({ stage: "knowledge_load", message: "正在匹配知识库...", percent: 96 })
        console.log("步骤 2: 智能匹配知识库...")
        const { professionTypes, contextContent, loadedFiles, anchorClauses } = await extractKnowledgeContext(documentContent)

        const professionNames = professionTypes.length > 0
          ? professionTypes.map(p => p.name).join("、")
          : "通用工程"

        console.log(`识别到的专业类型: ${professionNames}`)
        console.log(`加载的规范文件: ${loadedFiles.length} 个`)

        // 4. 获取知识库信息
        const knowledgeInfo = await getKnowledgeBaseInfo()

        // 5. 构建提示词
        sendProgress({ stage: "ai_review", message: "正在调用 AI 审核...", percent: 98 })
        const currentDate = new Date().toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        const maxDocLength = 30000
        const truncatedDoc = documentContent.length > maxDocLength
          ? documentContent.slice(0, maxDocLength) + "\n\n[文档内容过长，已截断...]"
          : documentContent

        const anchorClausesText = anchorClauses.length > 0
          ? anchorClauses
              .map((c) =>
                `【${c.standard_code} 第${c.clause_no}条 ${c.clause_title}】\n` +
                `原文：${c.clause_text}\n` +
                `审核要点：${c.audit_points ?? ""}\n` +
                `（匹配依据：${c.matchedBy.join("、")}）`
              )
              .join("\n\n")
          : ""

        const prompt = buildReviewPrompt(
          file.name,
          professionNames,
          currentDate,
          loadedFiles.length.toString(),
          contextContent,
          anchorClausesText,
          truncatedDoc
        )

        // 6. 调用 AI API
        console.log("步骤 4: 调用 AI API...")
        const completion = await client.chat.completions.create({
          model: modelName,
          messages: [
            {
              role: "system",
              content: `你是一位专业的施工方案审核专家。你的任务是：
1. 严格按照提供的知识库内容进行审核
2. 使用表格化格式输出审核报告
3. 每个问题都要给出具体依据和整改建议
4. 对于缺失内容要明确标注
5. 保持专业、客观的审核风格`,
            },
            { role: "user", content: prompt },
          ],
          stream: false,
          temperature: 0.2,
          max_tokens: 8000,
        })

        console.log("API 调用完成")
        const reviewResult = completion.choices[0]?.message?.content

        if (!reviewResult) {
          throw new Error("API 返回结果为空")
        }

        // 7. 提取审核结论并保存
        const reviewConclusion = extractConclusion(reviewResult)

        try {
          const recordData = {
            filename: file.name,
            file_size: file.size,
            profession_types: professionTypes.length > 0 ? professionTypes.map(p => p.name) : [professionNames],
            document_content: documentContent.slice(0, 10000),
            review_result: reviewResult,
            review_conclusion: reviewConclusion,
            knowledge_file: `共加载 ${loadedFiles.length} 个规范文件`,
            tokens_used: completion.usage?.total_tokens,
            model: modelName,
          }

          if (userId) {
            // 已登录用户：保存到 Supabase
            await saveReviewRecord({
              ...recordData,
              userId,
            })
          } else {
            // 未登录用户：保存到 Sqlite
            await saveReviewRecordToSqlite(recordData)
          }
        } catch (dbError) {
          console.error("保存审核记录失败:", dbError)
        }

        // 8. 返回结果
        sendProgress({ stage: "complete", message: "审核完成", percent: 100 })
        sendResult({
          success: true,
          result: reviewResult,
          conclusion: reviewConclusion,
          metadata: {
            filename: file.name,
            professionTypes: professionTypes.length > 0 ? professionTypes.map(p => p.name) : [professionNames],
            loadedFiles,
            knowledgeFileCount: knowledgeInfo.fileCount,
            documentLength: documentContent.length,
            tokensUsed: completion.usage?.total_tokens,
          },
        })
        close()
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
      "Connection": "keep-alive",
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 分块审核相关函数
// ═══════════════════════════════════════════════════════════════════════════

// 分块审核提示词模板 - 比正常审核更简洁
const CHUNK_REVIEW_PROMPT_TEMPLATE = `# 角色定位

你是一位施工方案审核专家。请对以下文档片段进行审核。

# 审核依据（精简版）
---
{knowledgeContext}
---

# 本片段精准条款锚点（必须优先逐条核对，违反任一条须出具意见）
---
{anchorClausesText}
---

# 待审核内容 - {chapterTitle}
---
{documentContent}
---

# 审核要求

1. 仅审核本片段内容，重点关注：
   - 技术方案是否合理
   - 参数设置是否符合规范
   - 是否存在明显问题

2. 输出格式：
   ## 审核意见

   ### 意见1
   - **【问题描述】** （填写具体问题）
   - **【方案对应内容】** （引用方案原文）
   - **【依据】** （引用相关规范条款原文）
   - **【整改要求/建议】** （填写具体整改建议）

3. 如果本片段内容完整、符合规范，请直接说明"本片段内容符合规范要求"。

4. 不要输出整体报告格式，只输出针对本片段的审核意见。
`

// 通用词黑名单：这些词几乎每个 chunk 都出现，无区分度，不作为 Hook3 分配依据
// （不去掉的话"每块都含钢管/立杆/搭设"会导致每块都分到全部锚点，失去按主题分配的意义）
const GENERIC_WORDS = new Set(["钢管", "立杆", "水平杆", "横杆", "搭设", "拆除", "检查", "验收", "设计计算", "施工", "材料"])

/**
 * Hook 3 · 把锚点条款按主题分配给相关 chunk
 * 命中条件：chunk 含该条款的"强信号词"（trigger_materials/processes + clause_title 分词，
 *           去掉通用词黑名单后的专属词，如"可调托座/剪刀撑/扫地杆/扣件/步距"），任一命中即分配
 * 未命中的 chunk 不分配（按通用审核依据审核）
 */
function assignClausesToChunks(
  anchorClauses: MatchedClause[],
  chunks: DocumentChunk[]
): Map<number, MatchedClause[]> {
  const map = new Map<number, MatchedClause[]>()
  if (anchorClauses.length === 0) return map

  for (const chunk of chunks) {
    const text = chunk.content
    const matched: MatchedClause[] = []
    for (const clause of anchorClauses) {
      const tags = [clause.trigger_materials, clause.trigger_processes]
        .filter((s): s is string => !!s)
        .join(",")
        .split(",")
        .map((s) => s.trim())
        .filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w))
      const titleWords = clause.clause_title
        .split(/[\s（）()、/\\-]+/)
        .map((s) => s.trim())
        .filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w))
      const hit = tags.some((t) => text.includes(t)) || titleWords.some((w) => text.includes(w))
      if (hit) matched.push(clause)
    }
    if (matched.length) map.set(chunk.id, matched)
  }
  return map
}

/**
 * 构建分块审核汇总提示词（硬编码模板，与 md 文件格式一致）
 */
function buildMergePrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  chunkCount: string,
  loadedFiles: string[],
  chunkReports: string,
  anchorClausesText?: string
): string {
  return `# 任务

你是一位施工方案审核专家。现在需要将以下多份分块审核报告合并成一份完整、专业的审核报告。

# 分块审核报告
---
${chunkReports}
---

# 精准条款锚点（汇总时必须保留这些条款的核对意见，不得遗漏；引用条款号与原文必须与下方一致）
---
${anchorClausesText || "（无锚点）"}
---

# 合并要求

1. **去重**：合并相同或相似的审核意见
2. **归类**：按以下结构整理
   - 通用性审核（法律、法规、标准规范）
   - 严重缺陷审核
   - 内容完整性审核
   - 专业性审核

3. **输出格式**：严格按以下格式输出

# ${filename}方案审核报告

## 1. 基本信息

**工程名称：** ${filename}

**专业类型：** ${professionNames}

**危大工程判定：** 根据方案内容判断是否危大工程（危险性较大工程、超过一定规模的危险性较大工程、一般专项方案）。

**审核依据：** 共加载 ${loadedFiles.length} 个规范文件，分别为：
${loadedFiles.map((f, i) => `${i + 1}. ${f}`).join("\n")}

分块审核共 ${chunkCount} 个块

**审核时间：** ${currentDate}

---

## 2. 通用性审核

（根据通用法律、法规、标准、规范审核，按1.法律2法规3标准和规范排序依次输出）

**审核意见1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制审核依据中的原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改建议）

**审核意见2：** ......

**审核意见3：** ......

---

## 3. 严重缺陷审核

（根据《住房城乡建设部办公厅关于印发《危险性较大的分部分项工程专项施工方案严重缺陷清单（试行）》的通知》检查是否存在缺漏项，如果存在请列出清单。）

---

## 4. 内容完整性审核

（以《危险性较大的分部分项工程专项施工方案编制指南》（建办质〔2021〕48号）为准审核）

---

## 5. 专业性审核

**审核意见1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制审核依据中的原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改建议）

**审核意见2：** ......

**审核意见3：** ......

---

## 6. 审核人员

| 角色 | 签字 | 日期 |
|------|------|------|
| 专业监理工程师 | | |
| 总监理工程师 | | |

4. **语言风格**：专业、客观、准确。

5. 【禁止事项】以下行为严格禁止：
   - 禁止编造知识库中不存在的规范文件名称或编号
   - 禁止编造规范中不存在的条款号
   - 禁止修改、增减条款原文内容（如原文是"75°"不得写成"75°±5°"）
   - 禁止引用不提供条款原文的依据
   - 如无法在知识库中找到确切依据，宁可不提该问题，也不得编造
`
}


/**
 * 分块审核处理函数（SSE 版本）
 */
async function handleChunkedReviewSSE(
  file: File,
  documentContent: string,
  client: OpenAI,
  modelName: string,
  userId: string | null,
  sendProgress: (event: ProgressEvent) => void,
  sendResult: (data: any) => void,
  sendError: (error: string) => void,
  close: () => void
): Promise<void> {
  console.log("=== 开始分块审核流程（SSE）===")

  const currentDate = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  try {
    // 1. 识别专业类型
    sendProgress({ stage: "chunk_identify", message: "正在识别专业类型...", percent: 10 })
    const professionTypes = await identifyProfessionTypes(documentContent)
    const professionNames = professionTypes.length > 0
      ? professionTypes.map(p => p.name).join("、")
      : "通用工程"
    console.log(`专业类型: ${professionNames}`)

    // ▸ Step 4：Hook 1 + Hook 2 拿全局锚点（分块流程共用，注入各 chunk + 汇总）
    let anchorClauses: MatchedClause[] = []
    try {
      const features = await identifySchemeFeatures(documentContent)
      anchorClauses = await getClausesByFeatures(features)
      console.log(`[Hook2] 分块流程精准锚点: ${anchorClauses.length} 条 (构造=${features.structureType ?? "—"}, 危大=${features.hazardLevel ?? "—"})`)
    } catch (e) {
      console.warn("[Hook2] 分块流程锚点匹配失败，降级无锚点:", e instanceof Error ? e.message : e)
    }

    // 2. 分割文档
    sendProgress({ stage: "chunk_split", message: "正在分割文档...", percent: 15 })
    const chunks = splitDocumentBySections(documentContent)
    console.log(`文档已分割为 ${chunks.length} 个块`)

    // Hook 3：把锚点按主题分给各 chunk（每块只看自己相关的锚点，上下文干净）
    const chunkAnchorMap = assignClausesToChunks(anchorClauses, chunks)
    console.log(`[Hook3] 锚点分配: ${[...chunkAnchorMap.entries()].map(([id, cs]) => `块${id + 1}=${cs.length}条`).join(", ")}`)

    // 3. 对每个块进行审核
    const chunkReports: string[] = []
    const allLoadedFiles: string[] = []
    let totalTokens = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkPercent = 15 + Math.round((i / chunks.length) * 70) // 15% - 85%

      sendProgress({
        stage: "chunk_review",
        message: `正在审核块 ${i + 1}/${chunks.length}: "${chunk.chapterTitle.slice(0, 30)}..."`,
        current: i + 1,
        total: chunks.length,
        percent: chunkPercent,
      })

      console.log(`\n--- 审核块 ${i + 1}/${chunks.length}: "${chunk.chapterTitle}" (${chunk.charCount} 字符) ---`)

      // 提取该块相关的精简知识库
      const { contextContent: simplifiedContext, loadedFiles: chunkLoadedFiles } =
        await extractSimplifiedKnowledgeContext(chunk.content, professionTypes)

      // 收集所有加载的知识库文件（去重）
      for (const f of chunkLoadedFiles) {
        if (!allLoadedFiles.includes(f)) {
          allLoadedFiles.push(f)
        }
      }

      // 构建提示词（含本 chunk 的专属锚点）
      const chunkAnchors = chunkAnchorMap.get(chunk.id) ?? []
      const chunkAnchorText = chunkAnchors.length > 0
        ? chunkAnchors
            .map((c) =>
              `【${c.standard_code} 第${c.clause_no}条 ${c.clause_title}】\n` +
              `原文：${c.clause_text}\n` +
              `审核要点：${c.audit_points ?? ""}`
            )
            .join("\n\n")
        : "（本片段无专项锚点，按上方审核依据通用审核）"

      const prompt = CHUNK_REVIEW_PROMPT_TEMPLATE
        .replace("{knowledgeContext}", simplifiedContext.slice(0, CHUNK_CONFIG.MAX_KNOWLEDGE_PER_CHUNK))
        .replace("{anchorClausesText}", chunkAnchorText)
        .replace("{chapterTitle}", chunk.chapterTitle)
        .replace("{documentContent}", chunk.content)

      // 调用 API
      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "system",
            content: `你是一位专业的施工方案审核专家。你的任务是：
1. 严格按照提供的知识库内容进行审核
2. 使用表格化格式输出审核报告
3. 每个问题都要给出具体依据和整改建议
4. 对于缺失内容要明确标注
5. 保持专业、客观的审核风格`,
          },
          { role: "user", content: prompt },
        ],
        stream: false,
        temperature: 0.2,
      })

      const chunkResult = completion.choices[0]?.message?.content || ""
      totalTokens += completion.usage?.total_tokens || 0

      // 保存块报告
      chunkReports.push(`## 块 ${i + 1}: ${chunk.chapterTitle}\n\n${chunkResult}`)
      console.log(`块 ${i + 1} 审核完成，Token: ${completion.usage?.total_tokens || "未知"}`)
    }

    // 4. 智能汇总
    sendProgress({ stage: "chunk_merge", message: "正在汇总审核结果...", percent: 90 })
    console.log("\n=== 开始智能汇总 ===")

    const globalAnchorText = anchorClauses.length > 0
      ? anchorClauses
          .map((c) =>
            `【${c.standard_code} 第${c.clause_no}条 ${c.clause_title}】\n` +
            `原文：${c.clause_text}\n` +
            `审核要点：${c.audit_points ?? ""}`
          )
          .join("\n\n")
      : ""

    const mergePrompt = buildMergePrompt(
      file.name,
      professionNames,
      currentDate,
      chunks.length.toString(),
      allLoadedFiles,
      chunkReports.join("\n\n---\n\n"),
      globalAnchorText
    )

    const mergeCompletion = await client.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "你是一位专业的施工方案审核专家，请将多份分块审核报告合并成一份完整、专业的审核报告。",
        },
        { role: "user", content: mergePrompt },
      ],
      stream: false,
      temperature: 0.2,
      max_tokens: 8000,
    })

    const finalResult = mergeCompletion.choices[0]?.message?.content || ""
    totalTokens += mergeCompletion.usage?.total_tokens || 0

    console.log(`智能汇总完成，总 Token: ${totalTokens}`)

    // 5. 提取审核结论
    const reviewConclusion = extractConclusion(finalResult)

    // 6. 保存审核记录
    try {
      const recordData = {
        filename: file.name,
        file_size: file.size,
        profession_types: professionTypes.map(p => p.name),
        document_content: documentContent.slice(0, 10000),
        review_result: finalResult,
        review_conclusion: reviewConclusion,
        knowledge_file: `分块审核 ${chunks.length} 个块`,
        tokens_used: totalTokens,
        model: modelName,
      }

      if (userId) {
        // 已登录用户：保存到 Supabase
        await saveReviewRecord({
          ...recordData,
          userId,
        })
      } else {
        // 未登录用户：保存到 Sqlite
        await saveReviewRecordToSqlite(recordData)
      }
      console.log("审核记录已保存")
    } catch (dbError) {
      console.error("保存审核记录失败:", dbError)
    }

    // 7. 返回结果
    sendProgress({ stage: "complete", message: "审核完成", percent: 100 })
    sendResult({
      success: true,
      result: finalResult,
      conclusion: reviewConclusion,
      metadata: {
        filename: file.name,
        professionTypes: professionTypes.map(p => p.name),
        chunkCount: chunks.length,
        documentLength: documentContent.length,
        tokensUsed: totalTokens,
        reviewMode: "chunked",
      },
    })
    close()
  } catch (error) {
    console.error("分块审核失败:", error)
    sendError(`分块审核失败: ${error instanceof Error ? error.message : "未知错误"}`)
    close()
  }
}
