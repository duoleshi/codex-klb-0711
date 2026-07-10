// scripts/check-match.ts
// 构造隔离验证：轮扣/盘扣/扣件/碗扣 各只捞自己的条款，不互窜
// 运行：npx tsx scripts/check-match.ts

import { getClausesByFeatures, type SchemeFeatures } from "../lib/clause-db"

const SEP = "═".repeat(70)

async function runCase(
  name: string,
  features: SchemeFeatures,
  expectCount: number,
  expectStandard?: string
): Promise<boolean> {
  const m = await getClausesByFeatures(features)
  // 区分：构造专属条款（structure_type 非空）vs 通用条款（structure_type=null，各构造共享）
  const constructorClauses = m.filter((c) => c.structure_type !== null)
  const genericClauses = m.filter((c) => c.structure_type === null)
  const constructorStandards = [...new Set(constructorClauses.map((c) => c.standard_code))]
  console.log(`\n${SEP}\n${name}\n${SEP}`)
  console.log(`命中 ${m.length} 条 = 构造专属 ${constructorClauses.length} + 通用 ${genericClauses.length}`)
  for (const c of m) {
    const tag = c.structure_type ? `[${c.structure_type}]` : "[通用]"
    console.log(`  • ${c.standard_code} 第${c.clause_no}条 《${c.clause_title}》 ${tag}`)
  }
  // 断言：构造专属条数 = expectCount，且都属 expectStandard（通用条额外，不违反隔离）
  let ok = constructorClauses.length === expectCount
  if (expectStandard && constructorClauses.length > 0) {
    ok = ok && constructorStandards.length === 1 && constructorStandards[0] === expectStandard
  }
  console.log(`${ok ? "✅" : "❌"} ${ok ? "通过" : "未通过"}`)
  return ok
}

// 通用型专业（全 structure_type=null，靠材料匹配）的验证：统计命中里属于该专业的条数
async function runCaseByProfession(
  name: string,
  features: SchemeFeatures,
  expectProfession: string,
  expectMinCount: number
): Promise<boolean> {
  const m = await getClausesByFeatures(features)
  const own = m.filter((c) => c.profession === expectProfession)
  console.log(`\n${SEP}\n${name}\n${SEP}`)
  console.log(`命中 ${m.length} 条，其中 ${expectProfession} 专业 ${own.length} 条（预期 ≥${expectMinCount}）`)
  for (const c of own.slice(0, 6)) {
    console.log(`  • ${c.standard_code} 第${c.clause_no}条 《${c.clause_title}》`)
  }
  if (own.length > 6) console.log(`  …另 ${own.length - 6} 条`)
  const ok = own.length >= expectMinCount
  console.log(`${ok ? "✅" : "❌"} ${ok ? "通过" : "未通过"}`)
  return ok
}

// 锁定专业验证：所有命中必须属于该专业（零跨专业污染）+ 数量不少于预期
// 注意：profession="general" 的强标通用锚点每次必带（设计如此），不算"外专业泄漏"，
//       且必须出现——这是强标豁免的核心承诺。
async function runCaseLocked(
  name: string,
  features: SchemeFeatures,
  lockedProfession: string,
  expectMinCount: number
): Promise<boolean> {
  const m = await getClausesByFeatures(features)
  const foreign = m.filter((c) => c.profession !== lockedProfession && c.profession !== "general")
  const hasGeneral = m.some((c) => c.profession === "general")
  console.log(`\n${SEP}\n${name}\n${SEP}`)
  console.log(`命中 ${m.length} 条（应属 ${lockedProfession} + 强标 general），外专业泄漏 ${foreign.length} 条，含强标 ${hasGeneral ? "✓" : "✗"}`)
  if (foreign.length > 0) {
    for (const c of foreign.slice(0, 5)) {
      console.log(`  ⚠️ 泄漏 ${c.profession}: ${c.standard_code} 第${c.clause_no}条`)
    }
  }
  const ok = m.length >= expectMinCount && foreign.length === 0 && hasGeneral
  console.log(`${ok ? "✅" : "❌"} ${ok ? "通过" : "未通过"}`)
  return ok
}

// 强标通用锚点（general）"每次必带 + 排最前"验证：
// 无论方案什么专业/构造（甚至未知体系），命中里必含 general 段，且首条必为 general（Hook2 排序保证）
async function runCaseGeneralAlways(name: string, features: SchemeFeatures): Promise<boolean> {
  const m = await getClausesByFeatures(features)
  const generalCount = m.filter((c) => c.profession === "general").length
  const firstIsGeneral = m.length > 0 && m[0].profession === "general"
  console.log(`\n${SEP}\n${name}\n${SEP}`)
  console.log(`命中 ${m.length} 条，含强标 general ${generalCount} 条，首条${firstIsGeneral ? "是" : "非"} general`)
  const ok = generalCount > 0 && firstIsGeneral
  console.log(`${ok ? "✅" : "❌"} ${ok ? "通过" : "未通过"}`)
  return ok
}

// 方案B：脚手架通用条款隔离验证
// 统计命中里属于 scaffolding 专业且不绑构造（structure_type=null）的条款条数——
// 这些是模板方案最易误捞的外架作业条款（连墙件/搭设同步/卸料平台禁令等）
async function runCaseScaffoldingGeneric(
  name: string,
  features: SchemeFeatures,
  expectCount: number
): Promise<boolean> {
  const m = await getClausesByFeatures(features)
  const scaffoldingGeneric = m.filter((c) => c.profession === "scaffolding" && c.structure_type === null)
  console.log(`\n${SEP}\n${name}\n${SEP}`)
  console.log(`命中 ${m.length} 条，其中脚手架通用条款 ${scaffoldingGeneric.length} 条（预期 ${expectCount}）`)
  for (const c of scaffoldingGeneric) {
    console.log(`  • ${c.standard_code} 第${c.clause_no}条 《${c.clause_title}》`)
  }
  const ok = scaffoldingGeneric.length === expectCount
  console.log(`${ok ? "✅" : "❌"} ${ok ? "通过" : "未通过"}`)
  return ok
}

// 体系专用优先排序验证：beforeStd/beforeClause 在命中里应排在 afterStd/afterClause 前
// （如盘扣式方案下 JGJ/T 231 6.2.2 专用排在 JGJ 300 5.2.1 通用之前）
async function runCaseOrder(
  name: string,
  features: SchemeFeatures,
  beforeStd: string, beforeClause: string,
  afterStd: string, afterClause: string
): Promise<boolean> {
  const m = await getClausesByFeatures(features)
  const beforeIdx = m.findIndex((c) => c.standard_code === beforeStd && c.clause_no === beforeClause)
  const afterIdx = m.findIndex((c) => c.standard_code === afterStd && c.clause_no === afterClause)
  console.log(`\n${SEP}\n${name}\n${SEP}`)
  console.log(`专用 ${beforeStd} 第${beforeClause}条 位置=${beforeIdx}；通用 ${afterStd} 第${afterClause}条 位置=${afterIdx}`)
  // 专用条款必须命中（验证补库成功）；通用若被方案B过滤则排序断言跳过（无矛盾即过）
  let ok = beforeIdx !== -1
  if (beforeIdx !== -1 && afterIdx !== -1) {
    ok = beforeIdx < afterIdx
  }
  console.log(`${ok ? "✅" : "❌"} ${ok ? "通过" : "未通过"}`)
  return ok
}

// 未锁定专业时零跨专业泄漏验证（治盾构机吊装方案命中模板监测 DBJ/T 15-197 这类污染）
// 关键：features 故意含"监测点/沉降"等模板监测触发词，验证 profession 过滤仍把模板条款挡住
async function runCaseNoForeignUnlocked(
  name: string,
  features: SchemeFeatures,
  mainProfession: string,
  expectMinCount: number
): Promise<boolean> {
  const m = await getClausesByFeatures(features)
  const foreign = m.filter((c) => c.profession !== mainProfession && c.profession !== "general")
  const hasGeneral = m.some((c) => c.profession === "general")
  console.log(`\n${SEP}\n${name}\n${SEP}`)
  console.log(`命中 ${m.length} 条（主专业 ${mainProfession} + 强标 general），外专业泄漏 ${foreign.length} 条，含强标 ${hasGeneral ? "✓" : "✗"}`)
  if (foreign.length > 0) {
    for (const c of foreign.slice(0, 5)) {
      console.log(`  ⚠️ 泄漏 ${c.profession}: ${c.standard_code} 第${c.clause_no}条`)
    }
  }
  const ok = foreign.length === 0 && hasGeneral && m.length >= expectMinCount
  console.log(`${ok ? "✅" : "❌"} ${ok ? "通过" : "未通过"}`)
  return ok
}

async function main() {
  const wheelCoupler: SchemeFeatures = {
    profession: "template", structureType: "轮扣式",
    materials: ["钢管", "可调托座", "剪刀撑", "扫地杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["DB44/T 1876-2016"],
  }
  const discCoupler: SchemeFeatures = {
    profession: "template", structureType: "盘扣式",
    materials: ["钢管", "可调托撑", "可调底座", "扫地杆", "水平杆", "剪刀撑", "斜杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ/T 231-2021"],
  }
  const coupler: SchemeFeatures = {
    profession: "template", structureType: "扣件式",
    materials: ["钢管", "可调托座", "剪刀撑", "扫地杆", "扣件"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ 130-2011"],
  }
  const cuplock: SchemeFeatures = {
    profession: "template", structureType: "碗扣式",
    materials: ["钢管", "可调托撑", "立杆", "水平杆", "斜撑杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ 166-2016"],
  }
  const cuplok: SchemeFeatures = {
    profession: "template", structureType: "套扣式",
    materials: ["可调托座", "可调底座", "剪刀撑", "扫地杆", "水平杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["DBJ/T 15-98-2019"],
  }
  const doorFrame: SchemeFeatures = {
    profession: "template", structureType: "门式",
    materials: ["门架", "跨距", "列距", "剪刀撑", "加固杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ/T 128-2019"],
  }
  // ── 脚手架专业（架体形式轴）──
  const groundScaffold: SchemeFeatures = {
    profession: "scaffolding", structureType: "落地式脚手架",
    materials: ["钢管", "立杆", "连墙件", "剪刀撑", "扫地杆", "扣件"],
    processes: ["搭设"], hazardLevel: null, possibleStandards: ["JGJ 130-2011"],
  }
  const cantileverScaffold: SchemeFeatures = {
    profession: "scaffolding", structureType: "悬挑式脚手架",
    materials: ["型钢", "悬挑梁", "钢丝绳", "U形拉环", "连墙件", "锚固螺栓"],
    processes: ["搭设", "设计计算"], hazardLevel: null, possibleStandards: ["JGJ 130-2011"],
  }
  const climbingScaffold: SchemeFeatures = {
    profession: "scaffolding", structureType: "附着升降式脚手架",
    materials: ["防倾覆装置", "防坠落装置", "同步控制装置", "附墙支座", "竖向主框架"],
    processes: ["安装", "搭设"], hazardLevel: null, possibleStandards: ["JGJ 202-2010"],
  }
  const cradle: SchemeFeatures = {
    profession: "scaffolding", structureType: "吊篮",
    materials: ["安全绳", "安全锁扣", "配重", "悬挂机构", "钢丝绳"],
    processes: ["安装", "搭设"], hazardLevel: null, possibleStandards: ["JGJ 202-2010"],
  }
  const dropPlatform: SchemeFeatures = {
    profession: "scaffolding", structureType: "卸料平台",
    materials: ["卸料平台", "限载牌", "脚手板", "安全网"],
    processes: ["搭设", "设计计算"], hazardLevel: null, possibleStandards: ["JGJ 80-2016"],
  }
  // ── 基坑专业（支护方法轴）──
  const soilNailWall: SchemeFeatures = {
    profession: "foundation", structureType: "土钉墙",
    materials: ["土钉", "喷射混凝土", "钢筋网", "面层"],
    processes: ["开挖", "设计计算", "验收"], hazardLevel: null, possibleStandards: ["GB50739-2011"],
  }
  const anchorSupport: SchemeFeatures = {
    profession: "foundation", structureType: "锚杆支护",
    materials: ["锚杆", "锚具", "钢绞线", "锚固段"],
    processes: ["设计计算", "张拉", "验收"], hazardLevel: null, possibleStandards: ["GB50086-2015"],
  }
  // ── 起重吊装专业（机械类型轴）──
  const towerCrane: SchemeFeatures = {
    profession: "crane", structureType: "塔式起重机",
    materials: ["塔式起重机", "塔吊基础", "力矩限制器", "群塔布置"],
    processes: ["安装", "设计计算", "验收"], hazardLevel: null, possibleStandards: ["GB5144-2006"],
  }
  const elevator: SchemeFeatures = {
    profession: "crane", structureType: "施工升降机",
    materials: ["施工升降机", "防坠安全器", "标定证书"],
    processes: ["安装", "检查", "验收"], hazardLevel: null, possibleStandards: ["JGJ 215-2010"],
  }
  // ── 拆除爆破专业（拆除方式轴）──
  const blastDemo: SchemeFeatures = {
    profession: "demolition", structureType: "爆破拆除",
    materials: ["爆破专项方案", "防护覆盖", "警戒布置图", "GB6722"],
    processes: ["爆破", "设计计算", "检查"], hazardLevel: null, possibleStandards: ["GB6722-2014"],
  }
  const mechDemo: SchemeFeatures = {
    profession: "demolition", structureType: "机械拆除",
    materials: ["施工组织设计", "机械选型表", "起重机"],
    processes: ["拆除", "验收"], hazardLevel: null, possibleStandards: ["JGJ 147-2016"],
  }
  // ── 暗挖专业（施工工法轴）──
  const shield: SchemeFeatures = {
    profession: "underground", structureType: "盾构法",
    materials: ["盾构机", "管片", "同步注浆", "开挖仓", "土仓压力"],
    processes: ["掘进", "注浆", "监测"], hazardLevel: null, possibleStandards: ["GB50446-2017"],
  }
  const pipeJack: SchemeFeatures = {
    profession: "underground", structureType: "顶管法",
    materials: ["顶管机", "泥水压力", "出土量", "触变泥浆"],
    processes: ["掘进", "监测", "检查"], hazardLevel: null, possibleStandards: ["DBJ/T 15-106-2015"],
  }
  // ── 幕墙/钢结构/装配式（有构造轴，用 runCase 验构造隔离）──
  const stickWall: SchemeFeatures = {
    profession: "curtain-wall", structureType: "构件式幕墙",
    materials: ["立柱", "铝型材", "横梁", "芯柱", "挂钩", "石材"],
    processes: ["安装", "设计计算"], hazardLevel: null, possibleStandards: ["JGJ 102-2003"],
  }
  const steelWeld: SchemeFeatures = {
    profession: "steel-structure", structureType: "焊接连接",
    materials: ["焊缝", "一级焊缝", "焊接工艺评定", "焊条", "钢材"],
    processes: ["焊接", "检查", "验收"], hazardLevel: null, possibleStandards: ["GB 50661-2011"],
  }
  const groutSleeve: SchemeFeatures = {
    profession: "prefabricated-concrete", structureType: "钢筋灌浆套筒连接",
    materials: ["灌浆套筒", "灌浆料", "钢筋", "连接钢筋", "接头试件"],
    processes: ["注浆", "检查", "验收"], hazardLevel: null, possibleStandards: ["JGJ 1-2014"],
  }
  // ── 通用型专业（无构造轴，全 structure_type=null，靠材料匹配，用 runCaseByProfession）──
  const handDugPile: SchemeFeatures = {
    profession: "pile", structureType: null,
    materials: ["人工挖孔桩", "护壁", "扩底", "孔内提升", "送风设备", "气体检测仪"],
    processes: [], hazardLevel: null, possibleStandards: ["JGJ 94-2008"],
  }
  const underwaterOp: SchemeFeatures = {
    profession: "underwater", structureType: null,
    materials: ["水下检测", "沉管隧道", "潜水作业", "水下防腐涂料", "GINA止水带"],
    processes: [], hazardLevel: null, possibleStandards: ["DBJ/T 15-146-2018"],
  }
  const newTech: SchemeFeatures = {
    profession: "new-technology", structureType: null,
    materials: ["新技术", "新工艺", "新材料", "新设备", "四新", "三新核准", "专题技术论证"],
    processes: [], hazardLevel: null, possibleStandards: ["建设部令第109号"],
  }
  const limitedSpace: SchemeFeatures = {
    profession: "limited-space", structureType: null,
    materials: ["有限空间", "密闭空间", "井下作业", "气体检测仪", "通风机", "作业票", "呼吸器"],
    processes: [], hazardLevel: null, possibleStandards: ["GB 8958-2006"],
  }
  const unknown: SchemeFeatures = {
    profession: "template", structureType: "框式",
    materials: [], processes: [], hazardLevel: null, possibleStandards: [],
  }

  const ok1 = await runCase("Case 1 轮扣式 → 5 条 DB44/T 1876", wheelCoupler, 5, "DB44/T 1876-2016")
  const ok2 = await runCase("Case 2 盘扣式 → 10 条 JGJ/T 231（含新6.2.2/6.2.3）", discCoupler, 10, "JGJ/T 231-2021")
  const ok3 = await runCase("Case 3 扣件式 → 5 条 JGJ 130", coupler, 5, "JGJ 130-2011")
  const ok4 = await runCase("Case 4 碗扣式 → 5 条 JGJ 166", cuplock, 5, "JGJ 166-2016")
  const ok5 = await runCase("Case 5 套扣式 → 4 条 DBJ/T 15-98", cuplok, 4, "DBJ/T 15-98-2019")
  const ok6 = await runCase("Case 6 门式 → 3 条 JGJ/T 128", doorFrame, 3, "JGJ/T 128-2019")
  const ok7 = await runCase("Case 7 框式（库中无）→ 0 条", unknown, 0)
  // 脚手架专业：各架体形式只捞自己的构造专属条款，不与模板串
  const ok8 = await runCase("Case 8 落地式脚手架 → 3 条 JGJ 130", groundScaffold, 3, "JGJ 130-2011")
  const ok9 = await runCase("Case 9 悬挑式脚手架 → 5 条 JGJ 130 §6.10", cantileverScaffold, 5, "JGJ 130-2011")
  const ok10 = await runCase("Case 10 附着升降式(爬架) → 5 条(JGJ202+GB55023)", climbingScaffold, 5)
  const ok11 = await runCase("Case 11 吊篮 → 4 条 JGJ 202 §5", cradle, 4, "JGJ 202-2010")
  const ok12 = await runCase("Case 12 卸料平台 → 2 条(JGJ80+GB55023)", dropPlatform, 2)
  // 基坑专业
  const ok13 = await runCase("Case 13 土钉墙 → 3 条(GB50739+DBJ/T15-20)", soilNailWall, 3)
  const ok14 = await runCase("Case 14 锚杆支护 → 3 条(DBJ/T15-20+GB50086)", anchorSupport, 3)
  // 起重吊装专业
  const ok15 = await runCase("Case 15 塔式起重机 → 7 条(多本规范)", towerCrane, 7)
  const ok16 = await runCase("Case 16 施工升降机 → 3 条 JGJ 215", elevator, 3, "JGJ 215-2010")
  // 拆除爆破专业
  const ok17 = await runCase("Case 17 爆破拆除 → 9 条(JGJ147+GB6722+GA)", blastDemo, 9)
  const ok18 = await runCase("Case 18 机械拆除 → 4 条 JGJ 147", mechDemo, 4, "JGJ 147-2016")
  // 暗挖专业
  const ok19 = await runCase("Case 19 盾构法 → 6 条(GB50446+CJJ217)", shield, 6)
  const ok20 = await runCase("Case 20 顶管法 → 3 条 DBJ/T 15-106", pipeJack, 3, "DBJ/T 15-106-2015")
  // 幕墙/钢结构/装配式：构造隔离
  const ok21 = await runCase("Case 21 构件式幕墙 → 4 条(JGJ102+JGJ133)", stickWall, 4)
  const ok22 = await runCase("Case 22 焊接连接 → 6 条 GB 50661", steelWeld, 6, "GB 50661-2011")
  const ok23 = await runCase("Case 23 钢筋灌浆套筒 → 6 条(JGJ1+GB/T51231)", groutSleeve, 6)
  // 通用型专业：靠材料匹配，验证本专业命中条数
  const ok24 = await runCaseByProfession("Case 24 人工挖孔桩 → 本专业≥8", handDugPile, "pile", 8)
  const ok25 = await runCaseByProfession("Case 25 水下作业 → 本专业≥5", underwaterOp, "underwater", 5)
  const ok26 = await runCaseByProfession("Case 26 四新 → 本专业≥6", newTech, "new-technology", 6)
  const ok27 = await runCaseByProfession("Case 27 有限空间 → 本专业≥8", limitedSpace, "limited-space", 8)
  // 大型吊装补强验证：流动式起重机 → 11 条 JGJ 276（原3 + 新补8）
  const mobileCrane: SchemeFeatures = {
    profession: "crane", structureType: "流动式起重机",
    materials: ["流动式起重机", "汽车吊", "履带吊", "吊索", "吊耳", "地锚", "试吊", "路基箱"],
    processes: ["吊装", "设计计算", "检查"], hazardLevel: null, possibleStandards: ["JGJ 276-2012"],
  }
  // 锁定验证：用户选了某专业 → 只捞该专业条款、零外专业泄漏
  const lockFoundation: SchemeFeatures = {
    profession: "foundation", structureType: "土钉墙", lockedProfession: "foundation",
    materials: ["土钉", "喷射混凝土", "钢筋网"], processes: ["开挖", "设计计算"],
    hazardLevel: null, possibleStandards: ["GB50739-2011"],
  }
  const lockLimited: SchemeFeatures = {
    profession: "limited-space", structureType: null, lockedProfession: "limited-space",
    materials: ["有限空间", "密闭空间", "气体检测仪", "通风机", "作业票"],
    processes: [], hazardLevel: null, possibleStandards: ["GB 8958-2006"],
  }
  const ok28 = await runCaseLocked("Case 28 锁定 foundation → 零外专业泄漏", lockFoundation, "foundation", 5)
  const ok29 = await runCaseLocked("Case 29 锁定 limited-space → 零外专业泄漏", lockLimited, "limited-space", 8)
  const ok30 = await runCase("Case 30 流动式起重机(大型吊装) → 11 条 JGJ 276", mobileCrane, 11, "JGJ 276-2012")
  // 强标通用锚点（general）"每次必带 + 排首"验证
  const ok31 = await runCaseGeneralAlways("Case 31 轮扣式方案 → 强标 general 必带且排首条", wheelCoupler)
  const ok32 = await runCaseGeneralAlways("Case 32 未知体系(框式) → 强标 general 仍必带", unknown)
  // 方案B：脚手架通用条款隔离 —— 模板方案默认不带外架作业条款，除非探测到外架/平台独立章节
  const pureTemplate: SchemeFeatures = {
    profession: "template", structureType: "盘扣式",
    materials: ["钢管", "可调托撑", "可调底座", "扫地杆", "水平杆", "剪刀撑", "斜杆", "立杆"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ/T 231-2021"],
    hasExternalScaffolding: false,
  }
  const templateWithExt: SchemeFeatures = {
    profession: "template", structureType: "盘扣式",
    materials: ["钢管", "可调托撑", "扫地杆", "水平杆", "剪刀撑", "立杆", "连墙件", "卸料平台"],
    processes: ["搭设"], hazardLevel: "超规模", possibleStandards: ["JGJ/T 231-2021"],
    hasExternalScaffolding: true,
  }
  const ok33 = await runCaseScaffoldingGeneric("Case 33 纯盘扣式模板(无外架章节) → 脚手架通用条款 0 条", pureTemplate, 0)
  const ok34 = await runCaseScaffoldingGeneric("Case 34 模板+外架混合(探测到外架章节) → 脚手架通用条款带入", templateWithExt, 14)
  // 体系专用优先：盘扣式方案命中里，JGJ/T 231 6.2.2(专用)应排在 JGJ 300 5.2.1(通用)前
  const ok35 = await runCaseOrder(
    "Case 35 盘扣式 → 6.2.2(专用)排在JGJ300 5.2.1(通用)前",
    discCoupler,
    "JGJ/T 231-2021", "6.2.2",
    "JGJ 300-2013", "5.2.1"
  )
  // 未锁定专业时零跨专业泄漏（治盾构机吊装方案命中模板监测条款的污染）
  // features 故意含"监测点/沉降/监测"——模拟方案有监测章节，验证即使含监测词，模板条款也被 profession 过滤挡住
  const craneLifting: SchemeFeatures = {
    profession: "crane", structureType: "流动式起重机",
    materials: ["履带吊", "吊耳", "钢丝绳", "卸扣", "吊钩", "监测点", "沉降"],
    processes: ["吊装", "设计计算", "监测", "验收"], hazardLevel: null, possibleStandards: ["JGJ 276-2012"],
  }
  const ok36 = await runCaseNoForeignUnlocked("Case 36 起重方案(未锁定·含监测词) → 零模板/脚手架泄漏", craneLifting, "crane", 90)

  const ok = ok1 && ok2 && ok3 && ok4 && ok5 && ok6 && ok7 && ok8 && ok9 && ok10 && ok11 && ok12
    && ok13 && ok14 && ok15 && ok16 && ok17 && ok18 && ok19 && ok20
    && ok21 && ok22 && ok23 && ok24 && ok25 && ok26 && ok27 && ok28 && ok29 && ok30 && ok31 && ok32 && ok33 && ok34 && ok35 && ok36
  console.log(`\n${SEP}\n${ok ? "✅" : "❌"} 构造隔离验证 ${ok ? "全部通过" : "未通过"}\n${SEP}\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error("验证失败:", e)
  process.exit(1)
})
