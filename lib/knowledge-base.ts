// ./lib/knowledge-base.ts

/**
 * 百能匹配知识库 - 从用户上传的文档中提取相关规范条文
 */

import fs from "fs"
import path from "path"
import { getClausesByFeatures, type MatchedClause, type SchemeFeatures } from "./clause-db"

// 知识库文件夹路径 - 修改为审核依据文件夹
const KNOWLEDGE_BASE_DIR = "方案审核依据"

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
    keywords: ["起重吊装", "塔吊", "塔式起重机", "施工电梯", "物料提升机", "龙门吊", "履带吊", "起重机械", "吊装", "盾构机吊装", "大型设备吊装", "重型吊装", "安装", "拆卸"],
    relatedStandards: ["起重", "吊装", "起重机", "机械设备"],
    folderName: "3起重吊装及起重机械安装拆卸工程",
  },
  {
    id: "scaffolding",
    name: "脚手架工程",
    keywords: ["脚手架", "落地式脚手架", "悬挑脚手架", "悬挑式脚手架", "附着式升降", "附着式升降脚手架", "吊篮", "卸料平台", "操作平台", "爬架", "外脚手架", "外架"],
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

// （老路径已废除）强制性通用标准（《智能体审核依据》md）整本加载 + 按专业切片逻辑已移除：
//   通用依据现由 clause.db 中 profession="general" 的精准锚点承担（源数据 lib/general-clauses.json，
//   由建办质63号/48号、部令37号、安全生产法、393号、GB55034 等提炼）。整本 md 因 context 限制读不完，
//   且会把无关体系规范灌进审核，故废。

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
// 注意：脚手架专业按"架体形式"(落地/悬挑/附着升降/吊篮/卸料平台)分构造，
// 与模板专业按"连接方式"(轮扣/盘扣/扣件/碗扣/套扣/门式)分构造，两轴不相交。
// profession 字段：identifyStructureType 按方案专业过滤词表，避免"落地扣件式外架"
// 被模板专业的"扣件式"抢判（命中满堂支撑条款而非落地式脚手架条款）。
const STRUCTURE_TYPE_KEYWORDS: {
  type: string
  profession: "template" | "scaffolding" | "foundation" | "crane" | "demolition" | "underground" | "curtain-wall" | "steel-structure" | "prefabricated-concrete"
  keywords: string[]
}[] = [
  // ── 模板专业：连接方式轴 ──
  { type: "轮扣式", profession: "template", keywords: ["轮扣式", "轮扣钢管", "轮扣架", "轮扣脚手架", "轮扣支撑", "轮扣式钢管", "轮盘"] },
  { type: "盘扣式", profession: "template", keywords: ["盘扣式", "承插型盘扣", "承插型盘扣式", "盘扣钢管", "盘扣架", "盘扣脚手架", "盘扣支撑", "盘扣式钢管", "B型立杆", "Z型立杆"] },
  { type: "扣件式", profession: "template", keywords: ["扣件式钢管脚手架", "扣件式脚手架", "扣件式钢管", "扣件式支撑架"] },
  { type: "碗扣式", profession: "template", keywords: ["碗扣式", "碗扣", "碗扣架", "碗扣脚手架", "碗扣支撑"] },
  { type: "套扣式", profession: "template", keywords: ["承插型套扣", "套扣式", "套扣架", "套扣脚手架"] },
  { type: "门式", profession: "template", keywords: ["门式钢管脚手架", "门式脚手架", "门式支撑架"] },
  // ── 脚手架专业：架体形式轴 ──
  { type: "落地式脚手架", profession: "scaffolding", keywords: ["落地式脚手架", "落地作业脚手架", "落地式双排", "落地式单排", "落地式钢管脚手架"] },
  { type: "悬挑式脚手架", profession: "scaffolding", keywords: ["悬挑式脚手架", "型钢悬挑脚手架", "悬挑脚手架", "型钢悬挑", "悬挑钢梁", "悬挑外架", "悬挑外脚手架", "悬挑式外脚手架", "拉杆式悬挑外架"] },
  { type: "附着升降式脚手架", profession: "scaffolding", keywords: ["附着式升降脚手架", "附着升降脚手架", "爬架", "升降脚手架", "附着升降作业平台"] },
  { type: "吊篮", profession: "scaffolding", keywords: ["高处作业吊篮", "电动吊篮", "悬挂式脚手架", "吊篮平台"] },
  { type: "卸料平台", profession: "scaffolding", keywords: ["卸料平台", "卸料", "转料平台", "接料平台"] },
  // ── 基坑专业：支护方法轴 ──
  { type: "排桩支护", profession: "foundation", keywords: ["排桩", "支护桩", "灌注排桩", "钻孔灌注桩支护", "咬合桩"] },
  { type: "地下连续墙", profession: "foundation", keywords: ["地下连续墙", "地连墙", "导墙", "成槽", "钢筋笼"] },
  { type: "土钉墙", profession: "foundation", keywords: ["土钉墙", "土钉支护", "复合土钉墙", "喷射混凝土面层"] },
  { type: "锚杆支护", profession: "foundation", keywords: ["锚杆支护", "预应力锚杆", "锚索", "土层锚杆", "锚固段"] },
  { type: "放坡开挖", profession: "foundation", keywords: ["放坡开挖", "分级放坡", "过渡平台", "坡率法"] },
  // ── 起重吊装专业：机械类型轴 ──
  { type: "塔式起重机", profession: "crane", keywords: ["塔式起重机", "塔吊", "塔机", "塔式起重"] },
  { type: "施工升降机", profession: "crane", keywords: ["施工升降机", "人货梯", "施工电梯", "SC升降机"] },
  { type: "物料提升机", profession: "crane", keywords: ["物料提升机", "龙门架", "井架", "货用升降机"] },
  { type: "流动式起重机", profession: "crane", keywords: ["流动式起重机", "汽车吊", "履带吊", "轮胎吊", "随车吊", "盾构机吊装", "大型设备吊装", "重型吊装"] },
  // ── 拆除爆破专业：拆除方式轴 ──
  { type: "人工拆除", profession: "demolition", keywords: ["人工拆除", "人工剔凿"] },
  { type: "机械拆除", profession: "demolition", keywords: ["机械拆除", "挖掘机拆除", "液压剪", "破碎锤"] },
  { type: "爆破拆除", profession: "demolition", keywords: ["爆破拆除", "控制爆破", "拆除爆破"] },
  // ── 暗挖专业：施工工法轴 ──
  { type: "盾构法", profession: "underground", keywords: ["盾构", "盾构法", "盾构机", "土压平衡", "泥水平衡", "同步注浆"] },
  { type: "顶管法", profession: "underground", keywords: ["顶管", "顶管法", "顶管机", "触变泥浆", "中继间"] },
  { type: "矿山法", profession: "underground", keywords: ["矿山法", "喷锚暗挖", "新奥法", "锚喷支护", "管棚", "超前小导管"] },
  { type: "冻结法", profession: "underground", keywords: ["冻结法", "冻结壁", "积极冻结", "联络通道冻结"] },
  // ── 幕墙专业：幕墙形式轴 ──
  { type: "构件式幕墙", profession: "curtain-wall", keywords: ["构件式幕墙", "构件式玻璃幕墙", "明框玻璃幕墙", "隐框玻璃幕墙", "半隐框玻璃幕墙", "构件式石材幕墙"] },
  { type: "单元式幕墙", profession: "curtain-wall", keywords: ["单元式幕墙", "单元式玻璃幕墙", "单元幕墙", "单元组件", "单元板块"] },
  { type: "点支承幕墙", profession: "curtain-wall", keywords: ["点支承玻璃幕墙", "点支承幕墙", "点式玻璃幕墙", "点式幕墙", "玻璃肋点支承", "拉索点支承"] },
  // ── 钢结构专业：连接/工法轴 ──
  { type: "焊接连接", profession: "steel-structure", keywords: ["焊接连接", "全焊透焊缝", "一级焊缝", "焊接工艺评定", "焊缝探伤", "超声波探伤"] },
  { type: "高强螺栓连接", profession: "steel-structure", keywords: ["高强度螺栓连接", "高强螺栓", "大六角头螺栓", "扭剪型螺栓", "扭矩系数", "抗滑移系数", "初拧", "终拧"] },
  { type: "钢构件吊装", profession: "steel-structure", keywords: ["钢构件吊装", "钢柱吊装", "钢梁吊装", "吊点", "索具", "平衡梁", "双机抬吊"] },
  { type: "网架安装", profession: "steel-structure", keywords: ["网架安装", "空间钢结构", "钢网壳", "螺栓球节点", "整体提升", "整体顶升", "高空散装"] },
  // ── 装配式专业：构件/连接轴 ──
  { type: "预制构件吊装", profession: "prefabricated-concrete", keywords: ["预制构件吊装", "预制墙板吊装", "预制柱吊装", "吊环", "吊具", "分配梁", "预制构件"] },
  { type: "钢筋灌浆套筒连接", profession: "prefabricated-concrete", keywords: ["钢筋灌浆套筒连接", "灌浆套筒", "套筒灌浆", "浆锚搭接", "灌浆料", "灌浆饱满度"] },
  { type: "预制墙板安装", profession: "prefabricated-concrete", keywords: ["预制墙板安装", "预制剪力墙", "预制叠合板", "预制楼梯", "临时支撑", "坐浆"] },
]

// 已定义构造的专业集合（identifyStructureType 据此判断是否按专业过滤词表）
const PROFESSIONS_WITH_STRUCTURE = new Set(STRUCTURE_TYPE_KEYWORDS.map((s) => s.profession))

// 涉及材料词表（命中即收录）
const MATERIAL_KEYWORDS = [
  "钢管", "可调托座", "可调托撑", "顶托", "U型托", "可调底座", "底座",
  "扫地杆", "立杆", "横杆", "剪刀撑", "扣件", "丝杆", "垫板",
  "模板", "木胶合板", "竹胶板", "钢模板", "铝合金模板", "方木", "对拉螺栓",
  // 基坑/暗挖/桩 扩展（支护/岩土类）
  "支护结构", "支撑", "腰梁", "锚杆", "土钉", "喷射混凝土", "灌注桩", "护壁", "扩底", "井圈",
  // 起重吊装扩展
  "塔式起重机", "施工升降机", "物料提升机", "钢丝绳", "吊钩", "力矩限制器", "防坠安全器",
  // 脚手架/卸料平台扩展
  "型钢", "悬挑梁", "悬挑钢梁", "U形拉环", "锚固螺栓", "固定段", "连墙件", "刚性连墙件",
  "卸料平台", "操作平台", "悬挑式操作平台", "脚手板", "安全网", "限载牌", "吊环", "卡环",
  "钢丝绳夹", "主体结构", "搁置点", "拉结点", "支撑点", "预埋件", "安全系数",
  // 幕墙扩展
  "硅酮结构密封胶", "铝型材", "立柱", "横梁", "后加锚栓", "钢化玻璃", "花岗石",
  // 钢结构扩展
  "高强度螺栓", "焊缝", "摩擦面", "防火涂料", "防腐涂料", "钢构件",
  // 装配式扩展
  "灌浆套筒", "灌浆料", "预制构件", "预制墙板", "预制楼梯",
  // 通用型专业（无构造轴，靠材料识别方案）—— pile / underwater / new-technology / limited-space
  "人工挖孔桩", "挖孔灌注桩", "孔内提升", "气体检测仪", "送风设备",
  "潜水作业", "沉管隧道", "水下检测", "水下防腐涂料",
  "新技术", "新工艺", "新材料", "新设备", "四新", "三新核准", "专题技术论证",
  "有限空间", "密闭空间", "受限空间", "井下作业", "作业票", "通风机", "呼吸器", "测爆仪",
]

// 关键工艺词表
const PROCESS_KEYWORDS = [
  "搭设", "拆除", "安装", "拆卸", "设计计算", "验算", "监测",
  "检查", "验收", "吊装", "焊接", "混凝土浇筑",
  // 基坑/暗挖/拆除等扩展工艺
  "开挖", "降水", "爆破", "支护", "注浆", "张拉", "附墙",
  "掘进", "拼装", "冻结",
]

// 构造类型 → 建议规范号（possibleStandards 辅助字段）
const STRUCTURE_TYPE_STANDARDS: Record<string, string[]> = {
  // 模板专业（连接方式轴）
  "轮扣式": ["DB44/T 1876-2016", "T/CCIAT 0003-2019", "JGJ 162-2008"],
  "盘扣式": ["JGJ/T 231-2021", "JGJ 162-2008"],
  "扣件式": ["JGJ 130-2011", "JGJ 162-2008"],
  "碗扣式": ["JGJ 166-2016", "JGJ 162-2008"],
  "套扣式": ["DBJ/T 15-98-2019"],
  "门式": ["JGJ/T 128-2019"],
  // 脚手架专业（架体形式轴）
  "落地式脚手架": ["JGJ 130-2011", "GB 55023-2022", "GB51210-2016"],
  "悬挑式脚手架": ["JGJ 130-2011", "GB 55023-2022"],
  "附着升降式脚手架": ["JGJ 202-2010", "GB 55023-2022", "DBJ/T 15-233-2021", "JGJ/T 183-2019"],
  "吊篮": ["JGJ 202-2010", "GB 19155"],
  "卸料平台": ["JGJ 80-2016", "GB 55023-2022"],
  // 基坑专业（支护方法轴）
  "排桩支护": ["DBJ/T 15-20-2016", "JGJ/T 396-2018"],
  "地下连续墙": ["DBJ/T 15-20-2016", "GB55003-2021"],
  "土钉墙": ["GB50739-2011", "CECS96-1997", "DBJ/T 15-20-2016"],
  "锚杆支护": ["GB50086-2015", "DBJ/T 15-20-2016"],
  "放坡开挖": ["DBJ/T 15-20-2016", "JGJ 180-2009"],
  // 起重吊装专业（机械类型轴）
  "塔式起重机": ["GB5144-2006", "JGJ 196-2010", "JGJ/T 187-2019", "JGJ 332-2014"],
  "施工升降机": ["JGJ 215-2010", "GB/T 34023-2017"],
  "物料提升机": ["JGJ 88-2010"],
  "流动式起重机": ["JGJ 276-2012", "GB 50278-2010"],
  // 拆除爆破专业（拆除方式轴）
  "人工拆除": ["JGJ 147-2016"],
  "机械拆除": ["JGJ 147-2016", "CJJ 248-2016"],
  "爆破拆除": ["JGJ 147-2016", "GB6722-2014", "GA991-2012"],
  // 暗挖专业（施工工法轴）
  "盾构法": ["GB50446-2017", "CJJ217-2014"],
  "顶管法": ["DBJ/T 15-106-2015", "CECS246-2008"],
  "矿山法": ["GB50086-2015", "TB 10304-2020"],
  "冻结法": ["NB/T 10222-2019"],
  // 幕墙专业（幕墙形式轴）
  "构件式幕墙": ["JGJ 102-2003", "JGJ 133-2001", "JGJ 336-2016", "GB/T 21086-2007"],
  "单元式幕墙": ["JGJ 102-2003", "JGJ 133-2001", "GB/T 21086-2007"],
  "点支承幕墙": ["JGJ 102-2003", "GB/T 21086-2007"],
  // 钢结构专业（连接/工法轴）
  "焊接连接": ["GB 50661-2011", "GB 55006-2021", "GB 50205-2020"],
  "高强螺栓连接": ["JGJ 82-2011", "GB/T 1231-2006", "GB 50205-2020"],
  "钢构件吊装": ["GB 50755-2012", "GB 55006-2021"],
  "网架安装": ["GB 50755-2012", "GB 50205-2020"],
  // 装配式专业（构件/连接轴）
  "预制构件吊装": ["JGJ 1-2014", "GB/T 51231-2016"],
  "钢筋灌浆套筒连接": ["JGJ 1-2014", "GB/T 51231-2016"],
  "预制墙板安装": ["JGJ 1-2014", "GB/T 51231-2016"],
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

function identifyStructureType(text: string, profession?: string): string | null {
  // 按专业过滤词表：每个专业只在自己的构造轴里选构造，避免跨专业误判
  // （如"落地扣件式外架"被模板专业的"扣件式"抢判）。未知专业则扫全部（兼容老行为）。
  const pool = profession && PROFESSIONS_WITH_STRUCTURE.has(profession as "template" | "scaffolding" | "foundation" | "crane" | "demolition" | "underground")
    ? STRUCTURE_TYPE_KEYWORDS.filter((s) => s.profession === profession)
    : STRUCTURE_TYPE_KEYWORDS
  let best: { type: string; score: number } | null = null
  for (const { type, keywords } of pool) {
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
export async function identifySchemeFeatures(documentContent: string, lockedProfessionId?: string): Promise<SchemeFeatures> {
  const text = documentContent

  // 1) 大类：锁定时直接用用户选的专业；否则复用关键词打分取 top1
  const profession = lockedProfessionId
    ?? (await identifyProfessionTypes(text))[0]?.id
    ?? "unknown"

  // 2) 构造类型（按已识别专业过滤词表，避免跨专业误判）
  const structureType = identifyStructureType(text, profession)

  // 3) 材料 / 4) 工艺
  const materials = scanPresentKeywords(text, MATERIAL_KEYWORDS)
  const processes = scanPresentKeywords(text, PROCESS_KEYWORDS)

  // 5) 危大等级
  const hazardLevel = identifyHazardLevel(text)

  // 6) 建议规范
  const possibleStandards = structureType ? (STRUCTURE_TYPE_STANDARDS[structureType] ?? []) : []

  // 7) 外脚手架/卸料平台章节探测（方案B）：复用 identifyStructureType 扫 scaffolding 构造词表。
  //    "落地式脚手架/悬挑式脚手架/附着升降式脚手架/吊篮/卸料平台" 为高区分度整词，
  //    纯模板支撑方案正文不出现；一旦出现即说明方案含独立外架/平台章节 → 脚手架通用条款才带入。
  const hasExternalScaffolding = profession === "scaffolding"
    ? true
    : !!identifyStructureType(text, "scaffolding")

  console.log(
    `[Hook1] 特征识别: profession=${profession}${lockedProfessionId ? "(锁定)" : ""}, structure=${structureType ?? "—"}, ` +
    `hazard=${hazardLevel ?? "—"}, materials=${materials.length}个, processes=${processes.length}个, 外架章节=${hasExternalScaffolding ? "有" : "无"}`
  )

  return { profession, structureType, materials, processes, hazardLevel, possibleStandards, hasExternalScaffolding, ...(lockedProfessionId ? { lockedProfession: lockedProfessionId } : {}) }
}

// （老路径已废除）matchRelevantFiles（按专业文件夹整本加载 .md）已移除：会把整个模板夹的
// 所有体系规范（含 JGJ 130 等）一锅端塞进 prompt，且 41 个文件 context 根本装不下（只截到 7 个）。
// 现按 Hook1+Hook2 精准捞锚点，体系过滤在 getClausesByFeatures 内完成。

/**
 * 提取审核所需的知识库内容
 */
export async function extractKnowledgeContext(
  documentContent: string,
  lockedProfessionId?: string
): Promise<{
  professionTypes: ProfessionType[]
  anchorClauses: MatchedClause[]
  loadedStandards: string[]
}> {
  // ⚠️ 老路径已废除（matchRelevantFiles 整本读 .md + loadMandatoryStandards 切片）：
  //   整本规范因 context 限制根本读不完（41 个通用文件只能截到 7 个），反而把不相关体系的
  //   规范（如轮扣式方案里的 JGJ 130 扣件式）灌进去污染审核。
  // 现唯一审核依据 = Hook1（方案特征）+ Hook2（精准锚点），其中 profession="general" 的
  //   强标通用锚点每次必带（见 getClausesByFeatures 的 general 豁免）。

  // 1. 识别专业类型：锁定时直接取该专业（跳过自动检测），未锁定走自动检测
  const lockedProfession = lockedProfessionId ? PROFESSION_TYPES.find(p => p.id === lockedProfessionId) : undefined
  const professionTypes = lockedProfession
    ? [lockedProfession]
    : await identifyProfessionTypes(documentContent)

  // 2. Hook1（方案特征）+ Hook2（精准锚点）—— 唯一审核依据来源
  let anchorClauses: MatchedClause[] = []
  try {
    const features = await identifySchemeFeatures(documentContent, lockedProfessionId)
    anchorClauses = await getClausesByFeatures(features)
    const generalCount = anchorClauses.filter(c => c.profession === "general").length
    console.log(
      `[Hook2] 精准锚点条款: ${anchorClauses.length} 条${lockedProfessionId ? `(锁定=${lockedProfessionId})` : ""} (构造=${features.structureType ?? "—"}, 危大=${features.hazardLevel ?? "—"}, 含强标通用 ${generalCount})`
    )
  } catch (e) {
    console.warn("[Hook2] 锚点匹配失败，降级为无锚点:", e instanceof Error ? e.message : e)
  }

  // 3. 锚点涉及的去重规范号（替代旧 loadedFiles 的展示用途，给前端/报告显示"用了哪些规范"）
  const loadedStandards = [...new Set(anchorClauses.map(c => c.standard_code))]

  return { professionTypes, anchorClauses, loadedStandards }
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

// （老路径已废除）extractSimplifiedKnowledgeContext + extractChunkKeywords 已移除：
//   分块流程不再按文件夹加载整本 .md，改由 Hook3（assignClausesToChunks）把精准锚点按主题分到各块 +
//   汇总时用全局 anchorClauses（含强标通用）。
