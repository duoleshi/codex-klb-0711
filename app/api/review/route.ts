import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { parseUploadedFile, ProgressCallback } from "@/lib/pdf-parser"
import {
  extractKnowledgeContext,
  getKnowledgeBaseInfo,
  ProfessionType,
  shouldUseChunkedReview,
  splitDocumentBySections,
  identifyProfessionTypes,
  identifySchemeFeatures,
  PROFESSION_TYPES,
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
 * 把锚点条款渲染成 prompt 文本：强标通用（profession="general"）单独成段、排最前；
 * 专业/构造专属条款随后。强标段每条前缀【强标·必审】，让 AI 优先核对跨专业强制性条款。
 */
function formatAnchorClauses(clauses: MatchedClause[]): string {
  if (clauses.length === 0) return ""
  const general = clauses.filter((c) => c.profession === "general")
  const profession = clauses.filter((c) => c.profession !== "general")
  const render = (c: MatchedClause, strong: boolean) => {
    const prefix = strong ? "【强标·必审】" : ""
    return (
      `${prefix}《${c.standard_code}》第${c.clause_no}条 ${c.clause_title}\n` +
      `原文：${c.clause_text}\n` +
      `审核要点：${c.audit_points ?? ""}` +
      (c.matchedBy && c.matchedBy.length ? `\n（匹配依据：${c.matchedBy.join("、")}）` : "")
    )
  }
  const parts: string[] = []
  if (general.length) {
    parts.push("══ 强标·必审（跨专业强制性条款，无论方案属何专业都必查，须优先逐条核对）══")
    parts.push(general.map((c) => render(c, true)).join("\n\n"))
  }
  if (profession.length) {
    parts.push("══ 专业/构造专属条款（已按脚手架体系过滤，仅含本方案相关）══")
    parts.push(profession.map((c) => render(c, false)).join("\n\n"))
  }
  return parts.join("\n\n")
}

/**
 * 构建审核提示词（硬编码模板，与 md 文件格式一致）
 */
function buildReviewPrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  anchorCount: string,
  anchorClausesText: string,
  documentContent: string
): string {
  return `# 角色定位

你是一位经验丰富的施工方案审核专家，精通建筑施工规范。请根据用户上传的施工方案，对照提供的精准条款锚点进行专业审核。

# 审核依据（精准条款锚点 —— 本次审核的唯一依据）

以下条款由代码按本方案的专业类型、脚手架体系、涉及材料与工艺从规范中精准提取（**取代**过往整本规范的粗放投喂）。其中：

- 标注 **【强标·必审】** 的为跨专业强制性条款（严重缺陷清单、编制指南、危大工程法规等），无论本方案属哪个专业都**必须优先逐条核对**；
- 其余为本方案专业/构造专属条款（已按脚手架体系过滤，不会出现无关体系的规范）。

审核要求：
1. **逐条对照**：每条判断方案是否符合，并在报告里**完整复制**条款原文（不得编造、修改或扩大）。
2. **严禁越界引用**：除以下条款外，不得引用其他规范条款——尤其不得把其他脚手架体系（如扣件式/盘扣式）的规范套到本方案。
3. 方案违反任一条均须出具审核意见。

---
${anchorClausesText || "（本方案类型暂未配置锚点条款，按通用要求审核）"}
---

# 待审核内容
---
${documentContent}
---

# 审核输出格式（必须严格遵守以下格式）

请严格按照以下格式输出审核报告：

# 分类标准（归章依据）

- **致命缺陷**（一票否决·会导致安全事故或结构失稳）：材料规格严重不符（如盘扣立杆壁厚3.0mm<3.2mm、外径错）、设计计算错误或缺失、高大模板监测方案缺失或报警值/频率/点距严重违规、关键构造（连墙件/剪刀撑/扫地杆）完全缺失、应急预案无法响应、违反强制性条文。
- **技术问题**（参数错误·不符合专用技术规范）：参数数值不符（如丝杆外露、步距、立杆间距、垂直度偏差）、构造做法不符专用规范（如竖向斜杆布置、可调托撑限值、剪刀撑角度）、脚手架体系规范引用错误（如盘扣式方案套用扣件式参数）。
- **管理问题**（编制缺项·内容不完整·表述不规范）：章节缺失（施工图纸/计算书/人员配备/进度计划）、内容不完整（材料计划不详、应急联系方式缺、风险辨识缺失）、表述模糊不规范（如"中间水平杆尽量拉通"）、资质与制度类。

每条意见按问题性质归入唯一章节，**同一问题只在一个章节出现**，不得跨章重复。**条款原文必须逐字复制锚点库原文，严禁概括、改写或合并条款编号**（如"第（一）至（九）条"范围引用禁止）。

# ${filename}方案审核报告

## 1. 基本信息

**工程名称：** ${filename}

**专业类型：** ${professionNames}

**危大工程判定：** 根据方案内容判断是否危大工程（危险性较大工程、超过一定规模的危险性较大工程、一般专项方案）。

**审核依据：** 共匹配 ${anchorCount} 条精准锚点条款（含强标通用，详见各段引用）

---

## 2. 致命缺陷审核

（一票否决项：会导致安全事故或结构失稳的问题。每条必须给出完整依据与整改要求。若确无致命缺陷，明确写"本方案未发现致命缺陷"。）

**缺陷1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
- **【整改要求/建议】** （具体可执行的整改建议）

**缺陷2：** ..。。

---

## 3. 技术问题审核

（参数错误或不符合专用技术规范的问题。）

**意见1：**

- **【问题描述】**
- **【方案对应内容】**
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
- **【整改要求/建议】**

**意见2：** ..。。

---

## 4. 管理问题审核

（编制缺项、内容不完整、表述不规范等问题。）

**意见1：**

- **【问题描述】**
- **【方案对应内容】**
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
- **【整改要求/建议】**

**意见2：** ..。。

---

## 5. 审核人员

| 角色 | 签字 | 日期 |
|------|------|------|
| 专业监理工程师 | | |
| 总监理工程师 | | |

---

# 强制要求

1. 严格依据提供的锚点条款审核，不得引用锚点库以外的规范文件或标准；尤其不得把其他脚手架体系（如扣件式）的规范套到本方案。

2. 每条审核意见必须包含完整四要素：
   - 问题描述：清晰描述问题所在
   - 方案对应内容：准确引用方案原文
   - 依据：必须包含规范名称、条款编号、条款原文（三者缺一不可）
   - 整改要求/建议：具体可执行的整改建议

3. 整改建议必须具体可执行，不得使用"建议完善"、"建议补充"等模糊表述。

4. 语言风格：专业、客观、准确。

5. 【禁止事项】以下行为严格禁止：
   - 禁止编造锚点库中不存在的规范文件名称或编号
   - 禁止编造规范中不存在的条款号
   - 禁止修改、增减条款原文内容（如原文是"400mm"不得写成"400mm±50mm"）
   - 禁止概括、改写或合并条款编号（如"第（一）至（九）条"范围引用一律禁止）
   - 禁止引用不提供条款原文的依据
   - 如无法在锚点库中找到确切依据，宁可不提该问题，也不得编造
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
        // 用户在 UI 锁定的危大专业 id（空=自动识别兜底）
        const lockedProfessionId = (formData.get("profession") as string) || undefined

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
          await handleChunkedReviewSSE(file, documentContent, client, modelName, userId, sendProgress, sendResult, sendError, close, lockedProfessionId)
          return
        }

        // 3. 提取知识库相关内容
        sendProgress({ stage: "knowledge_load", message: "正在匹配知识库...", percent: 96 })
        console.log("步骤 2: 智能匹配知识库...")
        const { professionTypes, anchorClauses, loadedStandards } = await extractKnowledgeContext(documentContent, lockedProfessionId)

        const professionNames = professionTypes.length > 0
          ? professionTypes.map(p => p.name).join("、")
          : "通用工程"

        console.log(`识别到的专业类型: ${professionNames}`)
        console.log(`精准锚点: ${anchorClauses.length} 条（涉及 ${loadedStandards.length} 本规范）`)

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

        const anchorClausesText = formatAnchorClauses(anchorClauses)

        const prompt = buildReviewPrompt(
          file.name,
          professionNames,
          currentDate,
          anchorClauses.length.toString(),
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
            knowledge_file: `精准锚点 ${anchorClauses.length} 条（涉及 ${loadedStandards.length} 本规范）`,
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
            loadedStandards,
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

# 本片段精准条款锚点（必须优先逐条核对，违反任一条须出具意见）
---
{anchorClausesText}
---

# 待审核内容 - {chapterTitle}
---
{documentContent}
---

# 审核要求

1. 仅就本片段**实际看到的内容**出具审核意见，重点关注：
   - 技术方案是否合理
   - 参数设置是否符合规范
   - 是否存在明显问题
   **重要**：若本片段未涉及某主题（如未看到可调托撑详图、未看到监测章节），**不得下"方案未提及/未明确"结论**——该内容可能在其他片段。只对本片段明确写错的参数/构造出具"参数错"意见；"内容缺失/未提及"类意见留给汇总阶段综合全局后判断，单块不下。

2. 输出格式（每条意见必须标注问题性质，供汇总归位参考）：
   ## 审核意见

   ### 意见1【致命】 或 【技术】 或 【管理】
   - **【问题描述】** （填写具体问题）
   - **【方案对应内容】** （引用方案原文）
   - **【依据】**
     - 规范名称：（锚点库中的规范名称）
     - 条款编号：（第X.X.X条）
     - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
   - **【整改要求/建议】** （填写具体整改建议）

   性质判定：【致命】会导致安全事故/结构失稳（材料规格严重不符、计算错误、监测缺失、关键构造缺失、违反强标）；【技术】参数数值/构造做法不符专用规范；【管理】编制缺项/内容不完整/表述不规范。

3. 如果本片段内容完整、符合规范，请直接说明"本片段内容符合规范要求"。

4. 不要输出整体报告格式，只输出针对本片段的审核意见。

5. 【禁止事项】条款原文必须逐字复制锚点库原文，**严禁概括、改写或合并条款编号**（如"第（一）至（九）条"范围引用禁止）；不得引用锚点库以外的规范；库内无确切依据则不提该问题。
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
  anchorCount: string,
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

1. **去重与调和**（必须严格执行——分块报告常有视角局限导致的矛盾）：
   - 合并相同或相似的审核意见。
   - 分块报告会对同一主题给出矛盾结论（如一处"写了但参数错"、另一处"全文未提及"）。此时**以"有具体内容"的描述为准**——"未提及"往往是该分块未覆盖到相关章节的**假阴性**，不是方案真没写。
   - **若同一规范条款（如6.2.4可调托撑、6.2.2竖向斜杆）既出现"参数错/有方案原文"又出现"未提及/未明确"，必须删除"未提及"那条，只保留有具体参数描述的意见**。
   - 若同一主题在多个分块被提及，合并为一条，以最具体的参数描述为准。
2. **归类与跨章去重**：每条意见按问题性质归入唯一章节（致命缺陷/技术问题/管理问题）。**同一规范条款（按条款号判断）只在最高级别章节出现一次**——例如壁厚不符既违反强标又算参数错，归"致命"后不得再在"技术"章重复；竖向斜杆（6.2.2）若已有参数审核意见，不得再以"未明确布置"在"管理"章重复。若某问题兼具"参数错"与"内容缺失"，按实际严重程度归入最高级别章节。
3. **条款原文逐字复制**：必须完整复制锚点库原文，**严禁概括、改写或合并条款编号**（如"第（一）至（九）条"这种范围引用一律禁止）；库内无确切依据则不提该问题。

# 分类标准（归章依据）

- **致命缺陷**（一票否决·会导致安全事故或结构失稳）：材料规格严重不符（如盘扣立杆壁厚3.0mm<3.2mm、外径错）、设计计算错误或缺失、高大模板监测方案缺失或报警值/频率/点距严重违规、关键构造（连墙件/剪刀撑/扫地杆）完全缺失、应急预案无法响应、违反强制性条文。
- **技术问题**（参数错误·不符合专用技术规范）：参数数值不符（如丝杆外露、步距、立杆间距、垂直度偏差）、构造做法不符专用规范（如竖向斜杆布置、可调托撑限值、剪刀撑角度）、脚手架体系规范引用错误（如盘扣式方案套用扣件式参数）。
- **管理问题**（编制缺项·内容不完整·表述不规范）：章节缺失（施工图纸/计算书/人员配备/进度计划）、内容不完整（材料计划不详、应急联系方式缺、风险辨识缺失）、表述模糊不规范（如"中间水平杆尽量拉通"）、资质与制度类。

# 输出格式（必须严格遵守）

# ${filename}方案审核报告

## 1. 基本信息

**工程名称：** ${filename}

**专业类型：** ${professionNames}

**危大工程判定：** 根据方案内容判断是否危大工程（危险性较大工程、超过一定规模的危险性较大工程、一般专项方案）。

**审核依据：** 共匹配 ${anchorCount} 条精准锚点条款（含强标通用）

分块审核共 ${chunkCount} 个块

**审核时间：** ${currentDate}

---

## 2. 致命缺陷审核

（一票否决项：会导致安全事故或结构失稳的问题。每条必须给出完整依据与整改要求。若确无致命缺陷，明确写"本方案未发现致命缺陷"。）

**缺陷1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
- **【整改要求/建议】** （具体可执行的整改建议）

**缺陷2：** ......

---

## 3. 技术问题审核

（参数错误或不符合专用技术规范的问题。）

**意见1：**

- **【问题描述】**
- **【方案对应内容】**
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
- **【整改要求/建议】**

**意见2：** ......

---

## 4. 管理问题审核

（编制缺项、内容不完整、表述不规范等问题。）

**意见1：**

- **【问题描述】**
- **【方案对应内容】**
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制锚点库原文，不得编造或修改）"
- **【整改要求/建议】**

**意见2：** ......

---

## 5. 审核人员

| 角色 | 签字 | 日期 |
|------|------|------|
| 专业监理工程师 | | |
| 总监理工程师 | | |

# 强制要求

1. 严格依据提供的锚点条款审核，不得引用锚点库以外的规范文件或标准。
2. 每条意见必须包含完整四要素：问题描述、方案对应内容、依据（规范名称+条款编号+条款原文，三者缺一不可）、整改要求/建议。
3. 整改建议必须具体可执行，不得使用"建议完善"、"建议补充"等模糊表述。
4. 语言风格：专业、客观、准确。
5. 【禁止事项】以下行为严格禁止：
   - 禁止编造锚点库中不存在的规范文件名称或编号
   - 禁止编造规范中不存在的条款号
   - 禁止修改、增减条款原文内容（如原文是"400mm"不得写成"400mm±50mm"）
   - 禁止概括、改写或合并条款编号（如"第（一）至（九）条"范围引用一律禁止）
   - 禁止引用不提供条款原文的依据
   - 如无法在锚点库中找到确切依据，宁可不提该问题，也不得编造
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
  close: () => void,
  lockedProfessionId?: string
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
    const professionTypes = lockedProfessionId
      ? PROFESSION_TYPES.filter(p => p.id === lockedProfessionId)
      : await identifyProfessionTypes(documentContent)
    const professionNames = professionTypes.length > 0
      ? professionTypes.map(p => p.name).join("、")
      : "通用工程"
    console.log(`专业类型: ${professionNames}${lockedProfessionId ? "(锁定)" : ""}`)

    // ▸ Step 4：Hook 1 + Hook 2 拿全局锚点（分块流程共用，注入各 chunk + 汇总）
    let anchorClauses: MatchedClause[] = []
    try {
      const features = await identifySchemeFeatures(documentContent, lockedProfessionId)
      anchorClauses = await getClausesByFeatures(features)
      console.log(`[Hook2] 分块流程精准锚点: ${anchorClauses.length} 条${lockedProfessionId ? `(锁定=${lockedProfessionId})` : ""} (构造=${features.structureType ?? "—"}, 危大=${features.hazardLevel ?? "—"})`)
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

      // 构建提示词（含本 chunk 的专属锚点）
      const chunkAnchors = chunkAnchorMap.get(chunk.id) ?? []
      const chunkAnchorText = formatAnchorClauses(chunkAnchors) || "（本片段无专项锚点，按通用要求审核）"

      const prompt = CHUNK_REVIEW_PROMPT_TEMPLATE
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

    const globalAnchorText = formatAnchorClauses(anchorClauses)

    const mergePrompt = buildMergePrompt(
      file.name,
      professionNames,
      currentDate,
      chunks.length.toString(),
      anchorClauses.length.toString(),
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
