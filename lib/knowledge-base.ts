// ./lib/knowledge-base.ts

/**
 * 百能匹配知识库 - 从用户上传的文档中提取相关规范条文
 */

import fs from "fs"
import path from "path"
import { getClausesByFeatures, type MatchedClause, type SchemeFeatures } from "./clause-db"

// 知识库文件夹路径 - 修改为审核依据文件夹
const KNOWLEDGE_BASE_DIR = "方案审核依据"

// 强制性通用标准文件路径
const MANDATORY_STANDARDS_FILE = "《智能体审核依据》通用及专用技术文档.md"

// 专业类型定义
export interface ProfessionType {
  id: string
  name: string
  keywords: string[] // 识别关键词
  relatedStandards: string[] // 相关规范文件的关键词（用于文件名匹配)
  folderName: string // 对应的文件夹名称
}

// 知识库文件类型定义
export interface KnowledgeFile {
  id: string
  fileName: string
  filePath: string
  content: string
  keywords: string[]
}

// 专业类型列表（13 个专业，按文件夹序号排列）
export const PROFESSION_TYPES: ProfessionType[] = [
  {
    id: "foundation",
    name: "基坑工程",
    keywords: ["基坑", "开挖深度", "支护", "降水", "边坡", "土方", "围护", "锚杆", "地下连续墙", "支撑体系", "地基基础"],
    relatedStandards: ["基坑", "地基", "土方", "边坡", "支撑"],
    folderName: "1基坑工程",
  },
  {
    id: "template",
    name: "模板支撑体系工程",
    keywords: ["模板", "支撑架", "高支模", "满堂架", "立杆", "可调托座", "剪刀撑", "支架", "混凝土模板"],
    relatedStandards: ["模板", "支撑", "混凝土"],
    folderName: "2模板支撑体系工程",
  },
  {
    id: "crane",
    name: "起重吊装及起重机械安装拆卸工程",
    keywords: ["起重吊装", "塔吊", "塔式起重机", "施工电梯", "物料提升机", "龙门吊", "履带吊", "起重机械", "吊装", "安装", "拆卸"],
    relatedStandards: ["起重", "吊装", "起重机", "机械设备"],
    folderName: "3起重吊装及起重机械安装拆卸工程",
  },
  {
    id: "scaffolding",
    name: "脚手架工程",
    keywords: ["脚手架", "落地式", "悬挑", "附着式升降", "吊篮", "卸料平台", "操作平台", "盘扣", "碗扣", "扣件式", "爬架"],
    relatedStandards: ["脚手架", "高处作业", "安全防护"],
    folderName: "4脚手架工程",
  },
  {
    id: "demolition",
    name: "拆除、爆破工程",
    keywords: ["拆除工程", "爆破", "机械拆除", "人工拆除", "建构筑物拆除"],
    relatedStandards: ["拆除", "爆破"],
    folderName: "5拆除、爆破工程",
  },
  {
    id: "underground",
    name: "暗挖工程",
    keywords: ["暗挖", "盾构", "顶管法", "矿山法", "隧道", "洞室", "地下工程"],
    relatedStandards: ["暗挖", "盾构", "顶管", "隧道", "地下"],
    folderName: "6暗挖工程",
  },
  {
    id: "curtain-wall",
    name: "建筑幕墙安装工程",
    keywords: ["幕墙", "玻璃幕墙", "石材幕墙", "金属幕墙", "幕墙安装", "构件式幕墙", "单元式幕墙"],
    relatedStandards: ["幕墙", "玻璃", "石材", "安装"],
    folderName: "7建筑幕墙安装工程",
  },
  {
    id: "pile",
    name: "人工挖孔桩工程",
    keywords: ["人工挖孔桩", "灌注桩", "预制桩", "挖孔", "桩基"],
    relatedStandards: ["人工挖孔桩", "桩基"],
    folderName: "8人工挖孔桩工程",
  },
  {
    id: "steel-structure",
    name: "钢结构安装工程",
    keywords: ["钢结构", "钢构件", "钢梁", "钢柱", "焊接", "螺栓连接", "吊装", "钢结构安装"],
    relatedStandards: ["钢结构", "钢构件", "焊接"],
    folderName: "9钢结构安装工程",
  },
  {
    id: "underwater",
    name: "水下作业工程",
    keywords: ["水下作业", "潜水", "水下焊接", "水下切割", "水下检测", "水下拆除"],
    relatedStandards: ["水下", "潜水", "水下作业"],
    folderName: "10水下作业工程",
  },
  {
    id: "prefabricated-concrete",
    name: "装配式建筑混凝土预制构件安装工程",
    keywords: ["装配式", "预制构件", "预制混凝土", "PC构件", "装配式建筑", "构件安装"],
    relatedStandards: ["装配式", "预制构件", "混凝土"],
    folderName: "11装配式建筑混凝土预制构件安装工程",
  },
  {
    id: "new-technology",
    name: "采用新技术、新工艺、新材料、新设备工程",
    keywords: ["新技术", "新工艺", "新材料", "新设备", "四新", "技术创新"],
    relatedStandards: ["新技术", "新工艺", "新材料", "新设备"],
    folderName: "12采用新技术、新工艺、新材料、新设备工程",
  },
  {
    id: "limited-space",
    name: "有限空间作业",
    keywords: ["有限空间", "受限空间", "封闭空间", "受限空间作业", "有限空间作业"],
    relatedStandards: ["有限空间", "受限空间"],
    folderName: "13有限空间作业",
  }
]

// 知识库缓存
let knowledgeFilesCache: KnowledgeFile[] | null = null
let knowledgeBaseDirPath: string | null = null

/**
 * 获取知识库文件夹路径
 */
function getKnowledgeBaseDir(): string {
  return path.join(process.cwd(), KNOWLEDGE_BASE_DIR)
}

/**
 * 从文件名提取关键词
 */
function extractKeywordsFromFileName(fileName: string): string[] {
  const keywords: string[] = []

  // 移除扩展名
  const nameWithoutExt = fileName.replace(/\.md$/i, "")

  // 提取标准编号（如 JGJ 130-2011, GB 50204 等）
  const standardPatterns = [
    /JGJ\s*[T]?\s*\d+[-\d]*/gi,
    /GB\s*[T]?\s*\d+[-\d]*/gi,
    /CJJ\s*[T]?\s*\d+[-\d]*/gi,
    /DBJ\s*[T]?\s*\d+[-\d]*/gi,
  ]

  for (const pattern of standardPatterns) {
    const matches = nameWithoutExt.match(pattern)
    if (matches) {
      keywords.push(...matches.map(m => m.replace(/\s+/g, "").toUpperCase()))
    }
  }

  // 提取中文关键词
  const chineseKeywords = [
    "基坑", "脚手架", "模板", "临时用电", "起重", "吊装", "拆除", "暗挖", "人工挖孔桩", "有限空间", "钢结构", "幕墙", "桩基", "边坡", "土方", "围护", "锚杆", "地下连续墙", "支撑体系", "地基基础",
    "监测", "降水", "支护", "混凝土模板", "脚手架", "高处作业", "安全防护", "用电", "电气", "焊接", "桩基", "地基", "边坡", "监测", "降水", "支护", "混凝土", "钢结构", "幕墙", "绿色施工",
  ]

  for (const keyword of chineseKeywords) {
    if (nameWithoutExt.includes(keyword)) {
      keywords.push(keyword)
    }
  }

  return keywords
}

/**
 * 递归遍历目录，加载所有 MD 文件
 */
function loadMdFilesRecursively(dir: string, baseFiles: KnowledgeFile[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const fileName = entry.name

    if (fileName.endsWith(".md")) {
      const content = fs.readFileSync(fullPath, "utf-8")
      const keywords = extractKeywordsFromFileName(fileName)

      baseFiles.push({
        id: fileName,
        fileName,
        filePath: fullPath,
        content,
        keywords,
      })
    } else if (entry.isDirectory()) {
      loadMdFilesRecursively(fullPath, baseFiles)
    }
  }
}

/**
 * 加载所有知识库文件
 */
export async function loadKnowledgeBase(): Promise<KnowledgeFile[]> {
  // 检查缓存
  if (knowledgeFilesCache && knowledgeBaseDirPath === getKnowledgeBaseDir()) {
    console.log("使用缓存的知识库文件列表")
    return knowledgeFilesCache
  }

  // 重新加载
  console.log(`重新加载知识库...`)
  knowledgeBaseDirPath = getKnowledgeBaseDir()
  knowledgeFilesCache = null

  const baseDir = getKnowledgeBaseDir()
  if (!fs.existsSync(baseDir)) {
    console.error(`知识库目录不存在: ${baseDir}`)
    throw new Error(`知识库目录不存在: ${baseDir}`)
  }

  console.log(`加载知识库目录: ${baseDir}`)

  const files: KnowledgeFile[] = []
  loadMdFilesRecursively(baseDir, files)

  // 缓存
  knowledgeFilesCache = files
  knowledgeBaseDirPath = baseDir
  console.log(`知识库加载完成: ${files.length} 个文件`)

  return files
}

/**
 * 获取知识库信息
 */
export async function getKnowledgeBaseInfo(): Promise<{ fileCount: number }> {
  const files = await loadKnowledgeBase()
  return { fileCount: files.length }
}

// 强制性通用标准文件路径
const mandatoryStandardsFilePath = path.join(
  process.cwd(),
  MANDATORY_STANDARDS_FILE
)

// 强制性通用标准缓存
let cachedMandatoryStandards: string | null = null

/**
 * 加载强制性通用标准
 */
async function loadMandatoryStandards(): Promise<string> {
  // 检查缓存
  if (cachedMandatoryStandards && knowledgeBaseDirPath === getKnowledgeBaseDir()) {
    console.log("使用缓存的强制性通用标准")
    return cachedMandatoryStandards
  }

  // 读取文件
  if (!fs.existsSync(mandatoryStandardsFilePath)) {
    console.warn(`强制性通用标准文件不存在: ${mandatoryStandardsFilePath}`)
    return ""
  }
  console.log(`加载强制性通用标准: ${mandatoryStandardsFilePath}`)

  cachedMandatoryStandards = fs.readFileSync(mandatoryStandardsFilePath, "utf-8").toString()
  console.log(`加载完成: ${cachedMandatoryStandards.length} 字符`)

  return cachedMandatoryStandards!
}

/**
 * 从《智能体审核依据》文件提取对应专业的强制性标准内容
 * 注意：由于智能体审核依据文件较大，这里只提取与专业相关的章节
 */
function extractMandatoryStandardsByProfession(
  mandatoryStandards: string,
  profession: ProfessionType
): string {
  if (!mandatoryStandards) {
    return ""
  }

  const lines = mandatoryStandards.split("\n")
  const result: string[] = []

  // 通用部分 (5.1)
  let inGeneralSection = false

  // 查找专业部分
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 检测是否是专业部分的开始
    // 格式通常是: "5.3.X XX专业" 或 "5.3.X 《规范名称》"
    if (line.match(/^5\.[23]\d*[\.\s]*(基坑|模板|脚手架|临时用电|起重|拆除|暗挖|幕墙|桩基|钢结构|有限空间|高处作业)/)) {
      // 检查是否匹配当前专业
      const professionKeywords = profession.keywords
      const lineLower = line.toLowerCase()

      const isMatch = professionKeywords.some(kw => lineLower.includes(kw))

      if (isMatch) {
        // 开始收集该专业的内容
        for (let j = i; j < lines.length; j++) {
          const nextLine = lines[j]
          if (nextLine.match(/^5\.[23]\d/) && nextLine.startsWith("5.1")) {
            // 遇到下一个章节，停止收集
            break
          }
          if (nextLine.trim()) {
            result.push(nextLine)
          }
        }
      }
    }
  }

  if (result.length === 0) {
    console.warn("未找到对应专业的强制性标准")
    return ""
  }

  return result.join("\n\n" + "═".repeat(20) + "\n")
}

/**
 * 识别文档的专业类型
 */
export async function identifyProfessionTypes(documentContent: string): Promise<ProfessionType[]> {
  const content = documentContent.toLowerCase()
  const scores: { profession: ProfessionType; score: number }[] = []

  for (const profession of PROFESSION_TYPES) {
    let score = 0
    for (const keyword of profession.keywords) {
      const regex = new RegExp(keyword, "gi")
      const matches = content.match(regex)
      if (matches) {
        score += matches.length * keyword.length
      }
    }
    scores.push({ profession, score })
  }

  // 按分数降序排序
  scores.sort((a, b) => b.score - a.score)

  // 返回分数最高的专业类型(最多3个)
  const threshold = scores.length > 0 ? scores[0].score * 0.2 : 0
  const result = scores
    .filter(s => s.score >= threshold)
    .slice(0, 3)
    .map(s => s.profession)

  console.log(`识别到的专业类型: ${result.map(p => p.name).join(", ") || "通用工程"}`)
  return result
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 2：Hook 1 · 预处理（identifySchemeFeatures，纯规则版）
// 输出 SchemeFeatures，供 Hook 2（clause-db.getClausesByFeatures）精准捞条款
// ═══════════════════════════════════════════════════════════════════════════

// 构造类型 → 高区分度关键词（用词组避免跨类型误命中：
// 如轮扣式方案里会出现"扣件式剪刀撑"，必须用整词"扣件式钢管脚手架"才不误判）
const STRUCTURE_TYPE_KEYWORDS: { type: string; keywords: string[] }[] = [
  { type: "轮扣式", keywords: ["轮扣式", "轮扣钢管", "轮盘"] },
  { type: "盘扣式", keywords: ["盘扣式", "承插型盘扣", "盘扣钢管"] },
  { type: "扣件式", keywords: ["扣件式钢管脚手架", "扣件式脚手架", "扣件式钢管"] },
  { type: "碗扣式", keywords: ["碗扣式", "碗扣"] },
  { type: "套扣式", keywords: ["承插型套扣", "套扣式"] },
  { type: "门式", keywords: ["门式钢管脚手架", "门式脚手架"] },
]

// 涉及材料词表（命中即收录）
const MATERIAL_KEYWORDS = [
  "钢管", "可调托座", "可调托撑", "顶托", "U型托", "可调底座", "底座",
  "扫地杆", "立杆", "横杆", "剪刀撑", "扣件", "丝杆", "垫板",
  "模板", "木胶合板", "竹胶板", "钢模板", "铝合金模板", "方木", "对拉螺栓",
]

// 关键工艺词表
const PROCESS_KEYWORDS = [
  "搭设", "拆除", "安装", "拆卸", "设计计算", "验算", "监测",
  "检查", "验收", "吊装", "焊接", "混凝土浇筑",
]

// 构造类型 → 建议规范号（possibleStandards 辅助字段）
const STRUCTURE_TYPE_STANDARDS: Record<string, string[]> = {
  "轮扣式": ["DB44/T 1876-2016", "T/CCIAT 0003-2019", "JGJ 162-2008"],
  "盘扣式": ["JGJ/T 231-2021", "JGJ 162-2008"],
  "扣件式": ["JGJ 130-2011", "JGJ 162-2008"],
  "碗扣式": ["JGJ 166-2016", "JGJ 162-2008"],
  "套扣式": ["DBJ/T 15-98-2019"],
  "门式": ["JGJ/T 128-2019"],
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function countKeywordHits(text: string, keywords: string[]): number {
  let sum = 0
  for (const k of keywords) {
    const matches = text.match(new RegExp(escapeRegExp(k), "g"))
    sum += matches ? matches.length : 0
  }
  return sum
}

function scanPresentKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter((k) => text.includes(k))
}

function identifyStructureType(text: string): string | null {
  let best: { type: string; score: number } | null = null
  for (const { type, keywords } of STRUCTURE_TYPE_KEYWORDS) {
    const score = countKeywordHits(text, keywords)
    if (score > 0 && (!best || score > best.score)) {
      best = { type, score }
    }
  }
  return best?.type ?? null
}

function identifyHazardLevel(text: string): string | null {
  // 超规模（高大模板 = 超过一定规模的危大工程）
  if (["高大模板", "高支模", "超过一定规模"].some((k) => text.includes(k))) return "超规模"
  // 搭设高度 ≥8m
  if (/搭设高度.{0,6}([8-9]|[1-9]\d)\s*m/.test(text)) return "超规模"
  // 一般危大
  if (["危大工程", "危险性较大", "专项施工方案"].some((k) => text.includes(k))) return "危大"
  return null
}

/**
 * Hook 1 · 预处理：从方案文档抽取结构化特征（纯规则版）
 * 细化原 identifyProfessionTypes 的"只识别大类"——补出构造类型/材料/工艺/危大
 */
export async function identifySchemeFeatures(documentContent: string): Promise<SchemeFeatures> {
  const text = documentContent

  // 1) 大类：复用现有关键词打分，取 top1
  const professions = await identifyProfessionTypes(text)
  const profession = professions[0]?.id ?? "unknown"

  // 2) 构造类型
  const structureType = identifyStructureType(text)

  // 3) 材料 / 4) 工艺
  const materials = scanPresentKeywords(text, MATERIAL_KEYWORDS)
  const processes = scanPresentKeywords(text, PROCESS_KEYWORDS)

  // 5) 危大等级
  const hazardLevel = identifyHazardLevel(text)

  // 6) 建议规范
  const possibleStandards = structureType ? (STRUCTURE_TYPE_STANDARDS[structureType] ?? []) : []

  console.log(
    `[Hook1] 特征识别: profession=${profession}, structure=${structureType ?? "—"}, ` +
    `hazard=${hazardLevel ?? "—"}, materials=${materials.length}个, processes=${processes.length}个`
  )

  return { profession, structureType, materials, processes, hazardLevel, possibleStandards }
}

/**
 * 根据专业类型匹配相关文件
 */
export async function matchRelevantFiles(
  professionTypes: ProfessionType[],
  allFiles: KnowledgeFile[]
): Promise<KnowledgeFile[]> {
  const relevantFiles: KnowledgeFile[] = []
  const addedFileIds = new Set<string>()

  // 1. 匹配专业相关文件
  for (const profession of professionTypes) {
    for (const file of allFiles) {
      if (addedFileIds.has(file.id)) continue

      // 检查文件路径是否包含专业文件夹名
      if (file.filePath.includes(profession.folderName)) {
        relevantFiles.push(file)
        addedFileIds.add(file.id)
        continue
      }

      // 检查文件关键词是否与专业相关标准匹配
      const isRelated = profession.relatedStandards.some(standard =>
        file.keywords.some(kw => kw.includes(standard) || standard.includes(kw)) ||
        file.fileName.includes(standard)
      )

      if (isRelated) {
        relevantFiles.push(file)
        addedFileIds.add(file.id)
      }
    }
  }

  // 2. 匹配通用规范文件（通用法律法规标准规范审核依据 文件夹）
  const generalFolderName = "通用法律法规标准规范审核依据"
  for (const file of allFiles) {
    if (addedFileIds.has(file.id)) continue

    if (file.filePath.includes(generalFolderName)) {
      relevantFiles.push(file)
      addedFileIds.add(file.id)
    }
  }

  console.log(`匹配到 ${relevantFiles.length} 个相关规范文件`)
  return relevantFiles
}

/**
 * 提取审核所需的知识库内容
 */
export async function extractKnowledgeContext(
  documentContent: string
): Promise<{
  professionTypes: ProfessionType[]
  contextContent: string
  loadedFiles: string[]
  anchorClauses: MatchedClause[]
}> {
  // 1. 加载所有知识库文件
  const allFiles = await loadKnowledgeBase()

  // 2. 加载强制性通用标准【优先】
  const mandatoryStandards = await loadMandatoryStandards()

  // 3. 识别专业类型
  const professionTypes = await identifyProfessionTypes(documentContent)

  // 4. 匹配相关文件
  const relevantFiles = await matchRelevantFiles(professionTypes, allFiles)

  // 5. 如果没有匹配到任何文件， 加载默认文件
  if (relevantFiles.length === 0) {
    const defaultKeywords = ["安全生产", "危大工程", "安全管理"]
    for (const file of allFiles) {
      if (defaultKeywords.some(kw => file.fileName.includes(kw))) {
        relevantFiles.push(file)
      }
    }
  }

  // 6. 构建上下文内容
  const contextParts: string[] = []
  const loadedFiles: string[] = []

  // 6.1 添加强制性通用标准（按专业提取）
  if (mandatoryStandards) {
    for (const profession of professionTypes) {
      const professionMandatoryContent = extractMandatoryStandardsByProfession(mandatoryStandards, profession)
      if (professionMandatoryContent) {
        contextParts.push(`【${profession.name} - 强制性通用标准】`)
        contextParts.push(professionMandatoryContent)
        loadedFiles.push(`《智能体审核依据》-${profession.name}`)
      }
    }
  }

  // 6.2 添加专业规范文件
  for (const file of relevantFiles) {
    // 限制每个文件的内容长度,避免过长
    const maxContentLength = 25000 // 单个文件最大 25KB， 调整一下
    var content = file.content.length > maxContentLength
      ? file.content.slice(0, maxContentLength) + "\n\n[内容过长，已截断]"
      : file.content

    contextParts.push(`【${file.fileName.replace(/\.md$/i, "")}】\n${content}`)
    loadedFiles.push(file.fileName.replace(/\.md$/i, ""))
  }

  // ▸ Step 3 新增：Hook 1（识别方案特征）+ Hook 2（精准捞锚点条款）
  //    并联在现有"按文件匹配"之后；条款库未就绪时降级为空（不影响主流程）
  let anchorClauses: MatchedClause[] = []
  try {
    const features = await identifySchemeFeatures(documentContent)
    anchorClauses = await getClausesByFeatures(features)
    console.log(
      `[Hook2] 精准锚点条款: ${anchorClauses.length} 条 (构造=${features.structureType ?? "—"}, 危大=${features.hazardLevel ?? "—"})`
    )
  } catch (e) {
    console.warn("[Hook2] 锚点匹配失败，降级为无锚点:", e instanceof Error ? e.message : e)
  }

  return {
    professionTypes,
    contextContent: contextParts.join("\n\n" + "═".repeat(50) + "\n\n"),
    loadedFiles,
    anchorClauses,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 分块审核功能
// ═══════════════════════════════════════════════════════════════════════════

// 分块审核配置
export const CHUNK_CONFIG = {
  MAX_CHARS_PER_CHUNK: 40000,           // 每块最大字符数（约 2 万汉字）
  MAX_TOTAL_CHARS_FOR_NORMAL: 50000,    // 超过此字数触发分块审核
  MAX_KNOWLEDGE_PER_CHUNK: 40000,       // 每块知识库最大字符数
  CHAPTER_PATTERNS: [                    // 章节标题识别模式
    /^第[一二三四五六七八九十百零\d]+[章节部篇]/,   // 第一章、第1章
    /^[一二三四五六七八九十]+[、.．]\s*/,          // 一、二、三、
    /^\d+[、.．]\s+/,                              // 1. 2. 3.
    /^第\d+[章节部篇]/,                           // 第1章
    /^\d+\.\d+\s+/,                               // 1.1 1.2
    /^[（(]\d+[)）]/,                             // (1) (2) 或 （1）（2）
  ],
}

// 文档块类型定义
export interface DocumentChunk {
  id: number
  content: string
  chapterTitle: string  // 章节标题
  charCount: number
}

/**
 * 按章节分割文档
 * 优先识别章节边界，如果识别不到则按字数均匀分割
 */
export function splitDocumentBySections(
  documentContent: string,
  maxCharsPerChunk: number = CHUNK_CONFIG.MAX_CHARS_PER_CHUNK
): DocumentChunk[] {
  const lines = documentContent.split("\n")
  const sections: { title: string; startLine: number }[] = []

  // 1. 识别所有章节边界
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    for (const pattern of CHUNK_CONFIG.CHAPTER_PATTERNS) {
      if (pattern.test(line)) {
        sections.push({ title: line.substring(0, 50), startLine: i })
        break
      }
    }
  }

  console.log(`识别到 ${sections.length} 个章节边界`)

  // 2. 如果没有识别到章节，按字数均匀分割
  if (sections.length === 0) {
    console.log("未识别到章节，按字数均匀分割")
    return splitByCharCount(documentContent, maxCharsPerChunk)
  }

  // 3. 按章节分组，确保每块不超过最大字数
  const chunks: DocumentChunk[] = []
  let currentChunkLines: string[] = []
  let currentChunkTitle = "文档开头"
  let chunkId = 0

  for (let i = 0; i < lines.length; i++) {
    // 检查是否到达新的章节
    const sectionIndex = sections.findIndex(s => s.startLine === i)

    if (sectionIndex !== -1) {
      // 检查当前块是否已经有内容
      const currentContent = currentChunkLines.join("\n")

      // 如果当前块不为空且加入新章节会超限，先保存当前块
      if (currentContent.length > 0 && currentContent.length > maxCharsPerChunk * 0.5) {
        chunks.push({
          id: chunkId++,
          content: currentContent,
          chapterTitle: currentChunkTitle,
          charCount: currentContent.length,
        })
        currentChunkLines = []
      }

      currentChunkTitle = sections[sectionIndex].title
    }

    currentChunkLines.push(lines[i])

    // 检查是否超过最大字数
    const content = currentChunkLines.join("\n")
    if (content.length >= maxCharsPerChunk) {
      chunks.push({
        id: chunkId++,
        content: content,
        chapterTitle: currentChunkTitle,
        charCount: content.length,
      })
      currentChunkLines = []
    }
  }

  // 保存最后一块
  if (currentChunkLines.length > 0) {
    const content = currentChunkLines.join("\n")
    chunks.push({
      id: chunkId++,
      content: content,
      chapterTitle: currentChunkTitle,
      charCount: content.length,
    })
  }

  console.log(`文档分割完成: ${chunks.length} 个块`)
  chunks.forEach((c, i) => {
    console.log(`  块${i + 1}: "${c.chapterTitle}" - ${c.charCount} 字符`)
  })

  return chunks
}

/**
 * 按字数均匀分割文档（兜底方案）
 */
function splitByCharCount(
  documentContent: string,
  maxCharsPerChunk: number
): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  const totalLength = documentContent.length
  const chunkCount = Math.ceil(totalLength / maxCharsPerChunk)

  for (let i = 0; i < chunkCount; i++) {
    const start = i * maxCharsPerChunk
    const end = Math.min(start + maxCharsPerChunk, totalLength)
    const content = documentContent.slice(start, end)

    chunks.push({
      id: i,
      content: content,
      chapterTitle: `第 ${i + 1} 部分`,
      charCount: content.length,
    })
  }

  return chunks
}

/**
 * 判断是否需要分块审核
 */
export function shouldUseChunkedReview(
  documentContent: string,
  fileSize?: number
): { needsChunking: boolean; reason: string } {
  const charCount = documentContent.length

  // 按字数判断
  if (charCount > CHUNK_CONFIG.MAX_TOTAL_CHARS_FOR_NORMAL) {
    return {
      needsChunking: true,
      reason: `文档字数 ${charCount.toLocaleString()} 超过阈值 ${CHUNK_CONFIG.MAX_TOTAL_CHARS_FOR_NORMAL.toLocaleString()}`
    }
  }

  // 按文件大小判断（扫描版 PDF 可能字数少但内容多）
  if (fileSize && fileSize > 10 * 1024 * 1024) {  // 10MB
    return {
      needsChunking: true,
      reason: `文件大小 ${(fileSize / 1024 / 1024).toFixed(1)}MB 超过 10MB 阈值`
    }
  }

  return {
    needsChunking: false,
    reason: "文档大小适中，使用正常审核流程"
  }
}

/**
 * 根据文档块内容提取精简的知识库上下文
 * 只包含与该块内容最相关的规范
 */
export async function extractSimplifiedKnowledgeContext(
  chunkContent: string,
  professionTypes: ProfessionType[]
): Promise<{
  contextContent: string
  loadedFiles: string[]
}> {
  // 1. 加载所有知识库文件
  const allFiles = await loadKnowledgeBase()

  // 2. 分析块的章节类型，确定需要哪些规范
  const chunkKeywords = extractChunkKeywords(chunkContent)

  // 3. 匹配相关文件
  const relevantFiles: KnowledgeFile[] = []
  const addedFileIds = new Set<string>()

  // 3.1 匹配专业相关文件
  for (const profession of professionTypes) {
    for (const file of allFiles) {
      if (addedFileIds.has(file.id)) continue

      // 检查文件路径是否包含专业文件夹名
      if (file.filePath.includes(profession.folderName)) {
        // 进一步检查文件关键词是否与块内容相关
        const isRelevantToChunk = chunkKeywords.some(kw =>
          file.fileName.includes(kw) ||
          file.content.substring(0, 2000).includes(kw)
        )

        if (isRelevantToChunk || file.filePath.includes("通用法律法规")) {
          relevantFiles.push(file)
          addedFileIds.add(file.id)
        }
      }
    }
  }

  // 3.2 始终包含通用法律法规
  const generalFolderName = "通用法律法规标准规范审核依据"
  for (const file of allFiles) {
    if (addedFileIds.has(file.id)) continue
    if (file.filePath.includes(generalFolderName)) {
      relevantFiles.push(file)
      addedFileIds.add(file.id)
    }
  }

  // 4. 构建上下文，限制总长度
  const contextParts: string[] = []
  const loadedFiles: string[] = []
  let totalLength = 0
  const maxLength = CHUNK_CONFIG.MAX_KNOWLEDGE_PER_CHUNK

  for (const file of relevantFiles) {
    if (totalLength >= maxLength) break

    const maxFileLength = Math.min(15000, maxLength - totalLength)
    const content = file.content.length > maxFileLength
      ? file.content.slice(0, maxFileLength) + "\n\n[内容过长，已截断]"
      : file.content

    contextParts.push(`【${file.fileName.replace(/\.md$/i, "")}】\n${content}`)
    loadedFiles.push(file.fileName.replace(/\.md$/i, ""))
    totalLength += content.length
  }

  return {
    contextContent: contextParts.join("\n\n" + "─".repeat(30) + "\n\n"),
    loadedFiles,
  }
}

/**
 * 提取文档块的关键词
 */
function extractChunkKeywords(content: string): string[] {
  const keywords: string[] = []

  // 章节类型关键词映射
  const sectionKeywords: { pattern: RegExp; keywords: string[] }[] = [
    { pattern: /编制依据|编制说明|编制目的/i, keywords: ["规范", "标准", "法规", "法律"] },
    { pattern: /工程概况|工程简介|工程情况/i, keywords: ["工程", "项目", "建设"] },
    { pattern: /施工方法|技术方案|施工工艺|技术措施/i, keywords: ["施工", "技术", "工艺", "方法"] },
    { pattern: /安全措施|安全管理|安全保障/i, keywords: ["安全", "防护", "保护", "措施"] },
    { pattern: /质量保证|质量控制|质量管理/i, keywords: ["质量", "验收", "检验", "控制"] },
    { pattern: /应急预案|应急措施|应急救援/i, keywords: ["应急", "救援", "事故", "预案"] },
    { pattern: /监测|监控|监测方案/i, keywords: ["监测", "观测", "检测", "监控"] },
    { pattern: /计算书|计算|验算/i, keywords: ["计算", "验算", "荷载", "强度"] },
    { pattern: /组织|管理|人员|机构/i, keywords: ["组织", "管理", "人员", "机构"] },
  ]

  // 检测章节类型
  for (const { pattern, keywords: kws } of sectionKeywords) {
    if (pattern.test(content)) {
      keywords.push(...kws)
    }
  }

  // 提取专业相关关键词
  const professionKeywords = [
    "基坑", "脚手架", "模板", "临时用电", "起重", "吊装", "拆除", "暗挖",
    "人工挖孔桩", "有限空间", "钢结构", "幕墙", "高处作业", "防护"
  ]

  for (const kw of professionKeywords) {
    if (content.includes(kw)) {
      keywords.push(kw)
    }
  }

  return [...new Set(keywords)]  // 去重
}

