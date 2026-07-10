// ./lib/clause-db.ts
//
// 条款精准匹配库（独立于 lib/db.ts，不依赖 supabase，单独 data/clause.db 文件）
//
// ▸ Step 0 产物：建表 + 灌入轮扣式模板支撑 5 条核心锚点条款
// ▸ 数据来源：方案审核依据/.../2模板支撑体系工程/DB44_T1876-2016广东省《轮扣式钢管脚手架安全技术规程》.md
//   （原文已清理 LaTeX 数学噪音如 $650\mathrm{mm}$ → 650mm，数值与"不应/不宜"措辞严格保留）
// ▸ 设计稿：docs/条款精准匹配改造设计稿.md

import initSqlJs from "sql.js"
import fs from "fs"
import path from "path"

// 条款库独立 db 文件（与 data/review.db 分离，各自演进）
const CLAUSE_DB_PATH = path.join(process.cwd(), "data", "clause.db")

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

export interface Clause {
  id: number
  standard_code: string
  standard_name: string
  clause_no: string
  clause_title: string
  clause_text: string
  audit_points: string | null
  profession: string
  structure_type: string | null
  trigger_materials: string | null
  trigger_processes: string | null
  hazard_level: string | null
  priority: number
  enabled: number
  created_at: string
  updated_at: string
}

type SeedClause = Omit<Clause, "id" | "created_at" | "updated_at">

// ─────────────────────────────────────────────────────────────────────────────
// 种子数据：DB44/T 1876-2016 轮扣式模板支撑 5 条核心锚点条款
// （Step 0 范围；后续可扩专业、扩条款）
// ─────────────────────────────────────────────────────────────────────────────

const STANDARD_CODE = "DB44/T 1876-2016"
const STANDARD_NAME = "轮扣式钢管脚手架安全技术规程"

const SEED_CLAUSES: SeedClause[] = [
  {
    standard_code: STANDARD_CODE,
    standard_name: STANDARD_NAME,
    clause_no: "7.1.6",
    clause_title: "可调托座伸出限值",
    clause_text:
      "模板支撑架立杆顶层横杆至模板支撑点的高度不应大于650mm，丝杆外露长度不应大于300mm，可调托撑插入立杆长度不应小于150mm。",
    audit_points:
      "核对方案可调托座三项限值：①立杆顶层横杆至模板支撑点高度≤650mm；②丝杆外露长度≤300mm；③可调托撑插入立杆长度≥150mm。方案未明确这三项参数、或任一参数超限，即为不符合。",
    profession: "template",
    structure_type: "轮扣式",
    trigger_materials: "可调托座,可调托撑,顶托,丝杆,U型托",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: STANDARD_CODE,
    standard_name: STANDARD_NAME,
    clause_no: "7.1.7",
    clause_title: "可调底座伸出限值",
    clause_text:
      "模板支撑架可调底座调节丝杆外露长度不宜大于200mm，最底层横杆离地高度不应大于500mm。",
    audit_points:
      "核对方案可调底座两项限值：①调节丝杆外露长度≤200mm；②最底层横杆离地高度≤500mm。注意 200mm 为「不宜」、500mm 为「不应」。",
    profession: "template",
    structure_type: "轮扣式",
    trigger_materials: "可调底座,底座,丝杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: STANDARD_CODE,
    standard_name: STANDARD_NAME,
    clause_no: "7.1.8",
    clause_title: "扫地杆设置",
    clause_text: "应设置纵向和横向扫地杆，且扫地杆高度不宜超过550mm。",
    audit_points:
      "核对方案是否同时设置纵、横向扫地杆（常漏设其中一向），且扫地杆高度（离地）≤550mm。",
    profession: "template",
    structure_type: "轮扣式",
    trigger_materials: "扫地杆,横杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: STANDARD_CODE,
    standard_name: STANDARD_NAME,
    clause_no: "9.2.2",
    clause_title: "步距与顶层横杆距离（高大模板）",
    clause_text:
      "立杆的纵横横杆间距、步距应根据受力计算确定，并满足轮扣横杆、立杆的模数关系，步距不宜大于1.2m，且顶层横杆与底模距离不应大于650mm。",
    audit_points:
      "高大模板支撑架专属条款：①步距≤1.2m（不宜）；②顶层横杆与底模距离≤650mm（不应）。方案步距>1.2m 即不符合。当方案判定为高大模板（超规模危大）时必查。",
    profession: "template",
    structure_type: "轮扣式",
    trigger_materials: "立杆,横杆",
    trigger_processes: "搭设,设计计算",
    hazard_level: "超规模",
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: STANDARD_CODE,
    standard_name: STANDARD_NAME,
    clause_no: "7.1.4",
    clause_title: "剪刀撑设置",
    clause_text:
      "模板支撑架的剪刀撑设置应符合下列要求：1）搭设高度不大于5m的满堂模板支撑架，当与周边结构无可靠拉结时，架体外周及内部应在竖向连续设置轮扣式钢管剪刀撑或扣件式钢管剪刀撑连接，竖向剪刀撑的间距和单幅剪刀撑的宽度宜为5m～8m且不大于6跨，剪刀撑与横杆的夹角宜为45°～60°，架体高度大于3倍步距时架体顶部应设置一道水平扣件式钢管剪刀撑，剪刀撑应延伸至周边；2）当架体搭设高度大于5m且不超过8m时，应在中间纵横向每隔4m～6m左右设置由下至上的连续竖向剪刀撑，同时四周设置由下至上的连续竖向剪刀撑，并在顶层、底层及中间层每隔4个步距设置扣件式钢管水平剪刀撑；3）搭设高度大于8m的满堂模板支撑架宜按本规程第9章的相关规定执行；4）支撑架的竖向剪刀撑和水平剪刀撑应与支撑架同步搭设，剪刀撑的搭接长度不应小于1m，且采用扣件式钢管剪刀撑的不应少于2个扣件连接，扣件盖板边缘至杆端不应小于100mm，扣件螺栓的拧紧力矩不应小于40N·m且不应大于65N·m；5）当同时满足搭设高度在5m以下、被支撑结构自重的荷载标准值小于5kPa、支撑结构支承于坚实均匀地基土或结构土、支撑结构与既有结构有可靠连接时，可采用无剪刀撑框架式支撑结构。",
    audit_points:
      "核对剪刀撑五要素：①按搭设高度分级（≤5m / 5-8m / >8m）设置竖向剪刀撑；②竖向剪刀撑间距5-8m且≤6跨、与横杆夹角45°-60°；③水平剪刀撑在顶层、底层及中间层每隔4个步距设置；④竖向与水平剪刀撑应同步搭设，搭接长度≥1m、扣件≥2个、扣件盖板至杆端≥100mm、拧紧力矩40-65N·m；⑤若方案声称采用无剪刀撑框架式支撑结构，须同时满足a-d 四个前提条件，否则不允许。",
    profession: "template",
    structure_type: "轮扣式",
    trigger_materials: "剪刀撑,扣件,钢管",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 盘扣式（JGJ/T 231-2021）5 条 ──
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "6.2.4",
    clause_title: "可调托撑伸出限值",
    clause_text:
      "支撑架可调托撑伸出顶层水平杆或双槽托梁中心线的悬臂长度不应超过650mm，且丝杆外露长度不应超过400mm，可调托撑插入立杆或双槽托梁长度不得小于150mm。",
    audit_points:
      "核对盘扣式可调托撑三项限值：①悬臂长度≤650mm；②丝杆外露长度≤400mm（注意：盘扣式为400mm，与轮扣式DB44/T 1876的300mm不同，勿混用）；③插入立杆长度≥150mm。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "可调托撑,可调托座,顶托,丝杆,U型托",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "6.2.5",
    clause_title: "可调底座与扫地杆",
    clause_text:
      "支撑架可调底座丝杆插入立杆长度不得小于150mm，丝杆外露长度不宜大于300mm，作为扫地杆的最底层水平杆中心线距离可调底座的底板不应大于550mm。",
    audit_points:
      "核对两项：①可调底座丝杆外露≤300mm（不宜）、插入立杆≥150mm；②作为扫地杆的最底层水平杆中心线距底板≤550mm（盘扣式以最底层水平杆兼作扫地杆）。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "可调底座,底座,丝杆,扫地杆,水平杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "6.1.3",
    clause_title: "步距限值",
    clause_text: "脚手架搭设步距不应超过2m。",
    audit_points:
      "核对盘扣式支撑架步距≤2m。另6.1.5规定当B型立杆荷载>40kN或Z型>65kN时顶层步距应缩小0.5m。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "立杆,水平杆",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "6.2.7",
    clause_title: "水平剪刀撑设置",
    clause_text:
      "支撑架应沿高度每间隔4个~6个标准步距应设置水平剪刀撑，并应符合现行行业标准《建筑施工扣件式钢管脚手架安全技术规范》JGJ 130中钢管水平剪刀撑的有关规定。",
    audit_points:
      "核对盘扣式水平剪刀撑：沿高度每隔4-6个标准步距设一道水平剪刀撑。竖向斜杆布置另按6.2.2表（依立杆轴力N与搭设高度H确定间隔跨数），高度>16m时顶层每跨布竖向斜杆（6.2.3）。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "剪刀撑,水平剪刀撑",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "6.1.4",
    clause_title: "竖向斜杆材质要求",
    clause_text: "脚手架的竖向斜杆不应采用钢管扣件。",
    audit_points:
      "核对盘扣式竖向斜杆：必须采用盘扣式专用斜杆，不应采用钢管扣件替代。若方案以扣件式钢管作竖向斜杆即违反本条。竖向斜杆布置按6.2.2表执行。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "竖向斜杆,斜杆,扣件,钢管",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 盘扣式竖向斜杆布置（6.2.2/6.2.3）——治盘扣式剪刀撑专用缺位，AI 越界编造 JGJ 300 通用，priority 5 ──
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "6.2.2",
    clause_title: "竖向斜杆布置（按N与H查表6.2.2）",
    clause_text:
      "对标准步距为1.5m的支撑架，应根据支撑架搭设高度、支撑架型号及立杆轴向力设计值进行竖向斜杆布置，竖向斜杆布置形式选用应符合表6.2.2的要求。注：1 立杆轴力设计值和脚手架搭设高度为同一独立架体内的最大值；2 每跨表示竖向斜杆沿纵横向每跨搭设，间隔1跨表示每间隔1跨搭设，间隔2跨表示每间隔2跨搭设，间隔3跨表示每间隔3跨搭设。",
    audit_points:
      "核对盘扣式竖向斜杆布置：方案须给出本架体立杆轴力设计值Nmax与搭设高度H，并按表6.2.2-1(B型)/表6.2.2-2(Z型)选定竖向斜杆布置形式（每跨/间隔1跨/间隔2跨/间隔3跨）。参考Z型表：N≤40且H≤8时间隔3跨、8<H≤16时间隔2跨、16<H≤24时间隔1跨；N越大或H越高布置越密。常见错误：方案不区分N与H直接给固定跨数、或跨数与表6.2.2不符。B型具体数值查表6.2.2-1（纸版规范）。此为盘扣式专属要求，优先于JGJ 300通用剪刀撑条款。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "竖向斜杆,斜杆,剪刀撑",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "6.2.3",
    clause_title: "高度>16m顶层每跨布竖向斜杆",
    clause_text:
      "当支撑架搭设高度大于16m时，顶层步距内应每跨布置竖向斜杆。",
    audit_points:
      "核对盘扣式高大支撑架（搭设高度>16m）：顶层步距内必须每跨布置竖向斜杆（不是间隔布置）。方案搭设高度>16m时必查，若顶层未明确「每跨」布置即不符。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "竖向斜杆,斜杆",
    trigger_processes: "搭设,设计计算",
    hazard_level: "超规模",
    priority: 5,
    enabled: 1,
  },
  // ── 盘扣式补充（规格/承载力/垂直度，解决锚点覆盖度，priority 4）──
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "3.0.1",
    clause_title: "立杆规格（B型/Z型外径）",
    clause_text:
      "根据立杆外径大小，脚手架可分为标准型（B型）和重型（Z型）。脚手架构件、材料及其制作质量应符合现行行业标准《承插型盘扣式钢管支架构件》JG/T 503的规定。",
    audit_points:
      "核对盘扣式立杆规格：标准型B型立杆钢管外径应为48.3mm，重型Z型应为60.3mm；壁厚及构件质量应符合JG/T 503《承插型盘扣式钢管支架构件》（盘扣式钢管壁厚通常不小于3.2mm）。方案若写Φ48×3.0即不符。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "立杆,钢管,盘扣架,盘扣立杆",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "6.1.5",
    clause_title: "立杆承载力分级与顶层步距",
    clause_text:
      "当标准型（B型）立杆荷载设计值大于40kN，或重型（Z型）立杆荷载设计值大于65kN时，脚手架顶层步距应比标准步距缩小0.5m。",
    audit_points:
      "核对盘扣式立杆承载力：盘扣式按B型（40kN）/Z型（65kN）分级设计，无轮扣式那种单根立杆≤12kN的统一限值。监测预警值/报警值应基于本工程设计计算值，不得套用12kN或10kN。当B型>40kN或Z型>65kN时顶层步距须缩小0.5m。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "立杆,可调托撑,可调底座",
    trigger_processes: "设计计算,监测",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 231-2021",
    standard_name: "建筑施工承插型盘扣式钢管脚手架安全技术标准",
    clause_no: "附录D",
    clause_title: "安装允许偏差（垂直度/水平度）",
    clause_text:
      "支撑架和作业架验收后应形成记录，记录表应符合本标准附录D的要求。附录D规定：立杆垂直度允许偏差≤L/500且不超过50mm；水平杆水平度允许偏差±5mm；可调托撑、可调底座垂直度允许偏差±5mm、插入立杆深度≥150mm。",
    audit_points:
      "核对盘扣式安装偏差：立杆垂直度≤L/500且≤50mm、水平杆水平度±5mm、可调托撑/底座垂直度±5mm且插入立杆≥150mm。方案自定的偏差值（如h/1050、±l/600）须以此规范值为准，不符则修改。",
    profession: "template",
    structure_type: "盘扣式",
    trigger_materials: "立杆,水平杆,可调托撑,可调底座",
    trigger_processes: "检查,验收",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 扣件式（JGJ 130-2011 满堂支撑架）5 条 ──
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.9.6",
    clause_title: "可调底座/托撑伸出限值",
    clause_text:
      "满堂支撑架的可调底座、可调托撑螺杆伸出长度不宜超过300mm，插入立杆内的长度不得小于150mm。",
    audit_points:
      "核对扣件式可调底座/托撑：螺杆伸出长度≤300mm（不宜）、插入立杆≥150mm。",
    profession: "template",
    structure_type: "扣件式",
    trigger_materials: "可调托座,可调托撑,可调底座,顶托,丝杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.9.1",
    clause_title: "立杆伸出长度与步距",
    clause_text:
      "满堂支撑架步距与立杆间距不宜超过本规范附录C表C-2~表C-5规定的上限值，立杆伸出顶层水平杆中心线至支撑点的长度不应超过0.5m。满堂支撑架搭设高度不宜超过30m。",
    audit_points:
      "核对扣件式满堂支撑架：①立杆伸出顶层水平杆至支撑点长度≤0.5m（不应）；②步距、立杆间距不超过附录C表C-2~C-5上限；③搭设高度≤30m。",
    profession: "template",
    structure_type: "扣件式",
    trigger_materials: "立杆,水平杆",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.9.3",
    clause_title: "剪刀撑设置（普通型/加强型）",
    clause_text:
      "满堂支撑架应根据架体的类型设置剪刀撑。普通型：在架体外侧周边及内部纵、横向每5m~8m，应由底至顶设置连续竖向剪刀撑，剪刀撑宽度应为5m~8m；在竖向剪刀撑顶部交点平面应设置连续水平剪刀撑；当支撑高度超过8m，或施工总荷载大于15kN/m²，或集中线荷载大于20kN/m时，扫地杆的设置层应设置水平剪刀撑，水平剪刀撑至架体底平面距离与水平剪刀撑间距不宜超过8m。竖向剪刀撑斜杆与地面的倾角应为45°~60°，水平剪刀撑与支架纵或横向夹角应为45°~60°。",
    audit_points:
      "核对扣件式剪刀撑：①普通型外侧周边及内部纵横向每5-8m设连续竖向剪刀撑（宽度5-8m）；②顶部设水平剪刀撑；③支撑高度>8m或施工总荷载>15kN/m²或集中线荷载>20kN/m时扫地杆层设水平剪刀撑、间距≤8m；④竖向/水平剪刀撑夹角45-60°。立杆间距在0.9m×0.9m~1.2m×1.2m等区间时应改按加强型（6.9.3第2款）设置。",
    profession: "template",
    structure_type: "扣件式",
    trigger_materials: "剪刀撑,水平剪刀撑,竖向剪刀撑",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.3.2",
    clause_title: "扫地杆设置",
    clause_text:
      "脚手架必须设置纵、横向扫地杆。纵向扫地杆应采用直角扣件固定在距钢管底端不大于200mm处的立杆上。横向扫地杆应采用直角扣件固定在紧靠纵向扫地杆下方的立杆上。",
    audit_points:
      "核对扣件式扫地杆：必须设纵、横向扫地杆，纵向扫地杆距钢管底端≤200mm（注意：扣件式为200mm，与盘扣式/轮扣式的550mm不同，勿混用）。",
    profession: "template",
    structure_type: "扣件式",
    trigger_materials: "扫地杆,纵向扫地杆,横向扫地杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "3.1.2",
    clause_title: "钢管规格（Φ48.3×3.6）",
    clause_text:
      "脚手架钢管宜采用Φ48.3×3.6钢管。每根钢管的最大质量不应大于25.8kg。",
    audit_points:
      "核对扣件式钢管规格：Φ48.3×3.6（壁厚3.6mm，比盘扣/轮扣的3.2mm厚），单根质量≤25.8kg。方案若写Φ48×3.0即不符。",
    profession: "template",
    structure_type: "扣件式",
    trigger_materials: "钢管,立杆,水平杆",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 碗扣式（JGJ 166-2016 模板支撑架构造）5 条 ──
  {
    standard_code: "JGJ 166-2016",
    standard_name: "建筑施工碗扣式钢管脚手架安全技术规范",
    clause_no: "6.3.3",
    clause_title: "可调托撑/底座伸出限值",
    clause_text:
      "立杆顶端可调托撑伸出顶层水平杆的悬臂长度不应超过650mm。可调托撑和可调底座螺杆插入立杆的长度不得小于150mm，伸出立杆的长度不宜大于300mm，安装时其螺杆应与立杆钢管上下同心，且螺杆外径与立杆钢管内径的间隙不应大于3mm。",
    audit_points:
      "核对碗扣式可调托撑/底座：①悬臂长度≤650mm（不应）；②螺杆插入立杆≥150mm；③螺杆伸出立杆≤300mm（不宜）；④螺杆与立杆钢管间隙≤3mm。",
    profession: "template",
    structure_type: "碗扣式",
    trigger_materials: "可调托撑,可调托座,可调底座,顶托,丝杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 166-2016",
    standard_name: "建筑施工碗扣式钢管脚手架安全技术规范",
    clause_no: "6.3.5",
    clause_title: "步距限值（Q235/Q345）",
    clause_text:
      "水平杆步距应通过设计计算确定：当立杆采用Q235级材质钢管时，步距不应大于1.8m；当立杆采用Q345级材质钢管时，步距不应大于2.0m。对安全等级为I级的模板支撑架，架体顶层两步距应比标准步距缩小至少一个节点间距。",
    audit_points:
      "核对碗扣式步距：Q235立杆≤1.8m、Q345立杆≤2.0m（均为不应）。安全等级I级时顶层两步距须缩小至少一个节点间距。须先确认方案立杆材质（Q235/Q345）再套对应限值。",
    profession: "template",
    structure_type: "碗扣式",
    trigger_materials: "立杆,水平杆",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 166-2016",
    standard_name: "建筑施工碗扣式钢管脚手架安全技术规范",
    clause_no: "6.3.6",
    clause_title: "立杆间距限值（Q235/Q345）",
    clause_text:
      "立杆间距应通过设计计算确定：当立杆采用Q235级材质钢管时，立杆间距不应大于1.5m；当立杆采用Q345级材质钢管时，立杆间距不应大于1.8m。",
    audit_points:
      "核对碗扣式立杆间距：Q235立杆≤1.5m、Q345立杆≤1.8m（均为不应）。须先确认立杆材质再套限值。",
    profession: "template",
    structure_type: "碗扣式",
    trigger_materials: "立杆",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 166-2016",
    standard_name: "建筑施工碗扣式钢管脚手架安全技术规范",
    clause_no: "6.3.8",
    clause_title: "竖向斜撑杆/剪刀撑设置",
    clause_text:
      "模板支撑架应设置竖向斜撑杆。安全等级为I级的模板支撑架应在架体周边、内部纵向和横向每隔4m~6m各设置一道竖向斜撑杆；安全等级为II级的模板支撑架应在架体周边、内部纵向和横向每隔6m~9m各设置一道竖向斜撑杆。当采用钢管扣件剪刀撑代替竖向斜撑杆时，I级每隔不大于6m、II级每隔不大于9m设置一道竖向钢管扣件剪刀撑，每道剪刀撑应连续设置，剪刀撑的宽度宜为6m~9m。",
    audit_points:
      "核对碗扣式竖向斜撑杆/剪刀撑：I级每4-6m一道（或用钢管扣件剪刀撑时每≤6m一道）、II级每6-9m一道（或钢管扣件剪刀撑每≤9m一道），剪刀撑宽度6-9m、连续设置。须先确认安全等级（I/II）再套间距。",
    profession: "template",
    structure_type: "碗扣式",
    trigger_materials: "竖向斜撑杆,斜撑杆,剪刀撑",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 166-2016",
    standard_name: "建筑施工碗扣式钢管脚手架安全技术规范",
    clause_no: "6.3.10",
    clause_title: "水平斜撑杆设置",
    clause_text:
      "模板支撑架应设置水平斜撑杆。安全等级为I级的模板支撑架应在架体顶层水平杆设置层、竖向每隔不大于8m设置一层水平斜撑杆，每层水平斜撑杆应在架体水平面的周边、内部纵向和横向每隔不大于8m设置一道；安全等级为II级的模板支撑架宜在架体顶层水平杆设置层设置一层水平剪刀撑，水平斜撑杆应在架体水平面的周边、内部纵向和横向每隔不大于12m设置一道。水平斜撑杆应在相邻立杆间呈条带状连续设置。",
    audit_points:
      "核对碗扣式水平斜撑杆：I级顶层+竖向每≤8m一层、水平每≤8m一道；II级顶层+水平每≤12m一道。水平斜撑杆须在相邻立杆间呈条带状连续设置。",
    profession: "template",
    structure_type: "碗扣式",
    trigger_materials: "水平斜撑杆,水平剪刀撑",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── D 通用规范锚点（structure_type=null，不绑构造，靠 materials/processes/hazardLevel 捞）──
  {
    standard_code: "DBJ/T 15-197-2020",
    standard_name: "高大模板支撑系统实时安全监测技术规范",
    clause_no: "3.0.1",
    clause_title: "高大支模界定",
    clause_text:
      "本规范所称高大支模是指房屋建筑与市政基础设施等施工现场搭设高度8m及以上，或搭设跨度18m及以上，或施工总荷载（设计值）15kN/m²及以上，或集中线荷载（设计值）20kN/m及以上的混凝土模板支撑工程。",
    audit_points:
      "判定方案是否属高大支模（满足任一即属）：搭设高度≥8m、跨度≥18m、施工总荷载≥15kN/m²、集中线荷载≥20kN/m。属高大支模则必须由建设单位委托第三方实时监测。",
    profession: "template",
    structure_type: null,
    trigger_materials: "高大模板,高支模,高大支模",
    trigger_processes: "监测",
    hazard_level: "超规模",
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-197-2020",
    standard_name: "高大模板支撑系统实时安全监测技术规范",
    clause_no: "5.1.2",
    clause_title: "监测点布置间距",
    clause_text:
      "高大支模工程监测点平面位置宜按网格形式布设，水平间距宜为10m~15m。水平位移及倾斜监测点应在高大支模的不同高度设置监测点，监测点竖向间距宜根据水平剪刀撑高度布设，但不宜大于6m。",
    audit_points:
      "核对监测点布置：平面按网格、水平间距10-15m；水平位移/倾斜监测点竖向间距≤6m。方案笼统写'每20-25m'或'仅主梁跨中'不符合。",
    profession: "template",
    structure_type: null,
    trigger_materials: "监测点",
    trigger_processes: "监测",
    hazard_level: "超规模",
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-197-2020",
    standard_name: "高大模板支撑系统实时安全监测技术规范",
    clause_no: "7.0.3",
    clause_title: "监测频率",
    clause_text:
      "监测项目的监测频率应综合高大支模工程的规模、周边环境、自然条件、施工阶段等因素确定；在无数据异常和事故征兆的情况下，混凝土浇筑期间监测频率不宜低于2次/min。",
    audit_points:
      "核对监测频率：混凝土浇筑期间≥2次/min（无异常时）。方案写'终凝后每天一次'或'每天一次'作为浇筑期频率不符合。",
    profession: "template",
    structure_type: null,
    trigger_materials: "监测频率",
    trigger_processes: "监测,混凝土浇筑",
    hazard_level: "超规模",
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-197-2020",
    standard_name: "高大模板支撑系统实时安全监测技术规范",
    clause_no: "8.0.4",
    clause_title: "监测报警值",
    clause_text:
      "监测报警值应根据高大支模工程设计要求与专项施工方案确定，并可参考表8.0.4。表8.0.4：支撑结构—立杆轴力（后加荷载设计值）、水平位移12mm、沉降8mm、倾斜4‰；立杆基础—差异沉降L/1000。当监测项目的累计变化量达到报警值的80%时应预警。",
    audit_points:
      "核对监测报警值（参考表8.0.4）：立杆轴力=后加荷载设计值、水平位移12mm、沉降8mm、倾斜4‰、立杆基础差异沉降L/1000；累计达报警值80%预警。方案报警值必须基于本工程设计计算值，不得套用 unrelated 数值（如12kN/10kN）。",
    profession: "template",
    structure_type: null,
    trigger_materials: "报警值,预警值",
    trigger_processes: "监测",
    hazard_level: "超规模",
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 300-2013",
    standard_name: "建筑施工临时支撑结构技术规范",
    clause_no: "5.1.4",
    clause_title: "扫地杆高度（分构造）",
    clause_text:
      "支撑结构应设置纵向和横向扫地杆，且宜符合下列规定：1对扣件式支撑结构，扫地杆高度不宜超过200mm；2对碗扣式支撑结构，扫地杆高度不宜超过350mm；3对承插式支撑结构，扫地杆高度不宜超过550mm。",
    audit_points:
      "核对扫地杆高度（须按方案实际采用的构造对应）：扣件式≤200mm、碗扣式≤350mm、承插式（盘扣/轮扣）≤550mm。方案扫地杆高度须与所采用构造类型匹配。",
    profession: "template",
    structure_type: null,
    trigger_materials: "扫地杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建质〔2009〕254号",
    standard_name: "建设工程高大模板支撑系统施工安全监督管理导则",
    clause_no: "1.3",
    clause_title: "高大模板支撑系统界定",
    clause_text:
      "本导则所称高大模板支撑系统是指建设工程施工现场混凝土构件模板支撑高度超过8m，或搭设跨度超过18m，或施工总荷载大于15kN/m²，或集中线荷载大于20kN/m的模板支撑系统。",
    audit_points:
      "判定方案是否属高大模板支撑系统（超过/大于任一即属）：支撑高度>8m、跨度>18m、施工总荷载>15kN/m²、集中线荷载>20kN/m。属高大模板则须专家论证+编制专项方案。",
    profession: "template",
    structure_type: null,
    trigger_materials: "高大模板,高支模",
    trigger_processes: "论证,编制",
    hazard_level: "超规模",
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 300-2013",
    standard_name: "建筑施工临时支撑结构技术规范",
    clause_no: "5.2.1",
    clause_title: "剪刀撑布置（通用）",
    clause_text:
      "竖向剪刀撑：框架式支撑结构应在纵向、横向分别布置竖向剪刀撑，竖向剪刀撑间隔不应大于6跨，每个剪刀撑的跨数不应超过6跨，剪刀撑倾斜角度宜在45°~60°之间，支撑结构外围应设置连续封闭的剪刀撑。水平剪刀撑：水平剪刀撑间隔层数不应大于6步，顶层应设置水平剪刀撑，扫地杆层宜设置水平剪刀撑。",
    audit_points:
      "核对剪刀撑（JGJ 300 通用）：竖向间隔≤6跨、每道跨数≤6、夹角45-60°、外围连续封闭；水平间隔≤6步、顶层必设、扫地杆层宜设。构造专用规范另有规定时以专用为准。",
    profession: "template",
    structure_type: null,
    trigger_materials: "剪刀撑,竖向剪刀撑,水平剪刀撑",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ 300-2013",
    standard_name: "建筑施工临时支撑结构技术规范",
    clause_no: "5.1.6",
    clause_title: "与既有结构连接（连墙/抱柱）",
    clause_text:
      "当有既有结构时，支撑结构应与既有结构可靠连接，并宜符合下列规定：竖向连接间隔不宜超过2步，优先布置在水平剪刀撑或水平斜杆层处；水平方向连接间隔不宜超过8m；附柱（墙）拉结杆件距支撑结构主节点宜不大于300mm；当遇柱时，宜采用抱柱连接措施。",
    audit_points:
      "核对支撑结构与既有结构连接：竖向≤2步、水平≤8m、距主节点≤300mm、遇柱宜抱柱。方案笼统写'有效拉结'不符合，须明确间距与构造做法。",
    profession: "template",
    structure_type: null,
    trigger_materials: "连墙件,抱柱,拉结,连墙",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-197-2020",
    standard_name: "高大模板支撑系统实时安全监测技术规范",
    clause_no: "8.0.5",
    clause_title: "危险报警情形",
    clause_text:
      "当出现下列情况之一时，必须立即进行危险报警，并采取应急措施：1监测数据达到报警值；2巡检发现高大支模出现明显变形、结构松动、有异常响声等情况时；3高大支模的杆件出现过大变形、倾斜、断裂或弯曲等明显破坏迹象；4模板断裂，混凝土泄漏；5基础开裂或下陷；6根据当地工程经验判断，出现其他必须进行危险报警的情况。",
    audit_points:
      "核对应急预案：监测达报警值、明显变形/松动/异响、杆件变形断裂、模板断裂漏浆、基础开裂下陷等情形须立即危险报警并采取应急措施。方案应急预案应覆盖这些触发情形。",
    profession: "template",
    structure_type: null,
    trigger_materials: "报警,应急,危险报警",
    trigger_processes: "监测,应急",
    hazard_level: "超规模",
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GB 55023-2022",
    standard_name: "施工脚手架通用规范",
    clause_no: "4.4.12",
    clause_title: "支撑脚手架高宽比",
    clause_text: "支撑脚手架独立架体高宽比不应大于3.0。",
    audit_points:
      "核对支撑脚手架（模板支撑架）独立架体高宽比≤3.0。高宽比>3 时须与既有结构可靠连接或设缆风绳等抗倾覆措施。",
    profession: "template",
    structure_type: null,
    trigger_materials: "高宽比",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 55023-2022",
    standard_name: "施工脚手架通用规范",
    clause_no: "5.4.2",
    clause_title: "拆除作业顺序",
    clause_text:
      "脚手架的拆除作业应符合下列规定：1架体拆除应按自上而下的顺序按步逐层进行，不应上下同时作业；2同层杆件和构配件应按先外后内的顺序拆除，剪刀撑、斜撑杆等加固杆件应在拆卸至该部位杆件时拆除；3作业脚手架连墙件应随架体逐层、同步拆除，不应先将连墙件整层或数层拆除后再拆架体；4拆除作业过程中，当架体悬臂段高度超过2步时，应加设临时拉结。",
    audit_points:
      "核对拆除：自上而下逐层、不上下同时、先外后内、加固杆件后拆、连墙件逐层同步拆（严禁先整层拆连墙件）、悬臂>2步加临时拉结。方案写'上下同时拆除'或'先拆连墙件'严重违规。",
    profession: "template",
    structure_type: null,
    trigger_materials: "拆除",
    trigger_processes: "拆除",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 套扣式（DBJ/T 15-98-2019 满堂模板支撑架）4 条 ──
  {
    standard_code: "DBJ/T 15-98-2019",
    standard_name: "建筑施工承插型套扣式钢管脚手架安全技术规程",
    clause_no: "6.1.10",
    clause_title: "可调托座伸出限值",
    clause_text:
      "可调螺杆或可调托座的螺杆插入立杆顶端的长度不应小于150mm，顶层水平杆中心线至模板支撑点的高度不应大于650mm。",
    audit_points:
      "核对套扣式可调托座：螺杆插入立杆≥150mm、顶层水平杆至模板支撑点≤650mm。",
    profession: "template",
    structure_type: "套扣式",
    trigger_materials: "可调托座,可调螺杆,顶托,丝杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-98-2019",
    standard_name: "建筑施工承插型套扣式钢管脚手架安全技术规程",
    clause_no: "6.1.11",
    clause_title: "可调底座与扫地杆",
    clause_text:
      "模板支撑架可调底座调节螺杆外露长度不宜大于250mm，最底层水平杆离地高度不应大于550mm。",
    audit_points:
      "核对套扣式：可调底座螺杆外露≤250mm（不宜）、最底层水平杆（扫地杆）离地≤550mm。",
    profession: "template",
    structure_type: "套扣式",
    trigger_materials: "可调底座,底座,扫地杆,水平杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-98-2019",
    standard_name: "建筑施工承插型套扣式钢管脚手架安全技术规程",
    clause_no: "6.1.6",
    clause_title: "高大模板步距与剪刀撑",
    clause_text:
      "搭设高度8m及以上或施工总荷载大于15kN/m²或集中线荷载大于20kN/m或集中力大于7kN点的模板支撑架，步距不应大于1.2m，并应在架体外周及内部纵、横向每3m~5m由底至顶设置连续竖向剪刀撑；在架体上部、下部和中间每隔3m~4m设置一道连续水平剪刀撑，剪刀撑宽度为3m~5m。",
    audit_points:
      "核对套扣式高大模板（搭设高度≥8m 或超荷载）：步距≤1.2m、竖向剪刀撑每3-5m、水平剪刀撑每3-4m、剪刀撑宽3-5m。高大模板（超规模）时必查。",
    profession: "template",
    structure_type: "套扣式",
    trigger_materials: "剪刀撑,水平剪刀撑,竖向剪刀撑",
    trigger_processes: "搭设",
    hazard_level: "超规模",
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-98-2019",
    standard_name: "建筑施工承插型套扣式钢管脚手架安全技术规程",
    clause_no: "6.1.8",
    clause_title: "剪刀撑夹角与搭接",
    clause_text:
      "支撑架的竖向剪刀撑和水平剪刀撑应与支撑架同步搭设，竖向剪刀撑的斜杆与地面的倾角应为45°~60°，水平剪刀撑与支撑架纵向或横向夹角应为45°~60°。采用扣件式钢管剪刀撑时，钢管接长搭接长度不应小于1m，并应采用不少于2个旋转扣件固定，端部扣件盖板边缘至杆端距离不应小于100mm，扣件螺栓拧紧力矩不应小于40N·m且不应大于65N·m。",
    audit_points:
      "核对套扣式剪刀撑：竖向/水平夹角45-60°、同步搭设；扣件式搭接≥1m、≥2旋转扣件、杆端≥100mm、拧紧40-65N·m。",
    profession: "template",
    structure_type: "套扣式",
    trigger_materials: "剪刀撑,扣件",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 门式（JGJ/T 128-2019 门式支撑架）3 条 ──
  {
    standard_code: "JGJ/T 128-2019",
    standard_name: "建筑施工门式钢管脚手架安全技术标准",
    clause_no: "6.4.1",
    clause_title: "门式支撑架尺寸限值",
    clause_text:
      "门式支撑架满堂支撑架：门架跨距不应大于1.5m，门架列距不应大于1.8m，搭设高度不应大于30m，高宽比不应大于3。当高宽比大于2时应有侧向稳定措施。",
    audit_points:
      "核对门式满堂支撑架：门架跨距≤1.5m、列距≤1.8m、搭设高度≤30m、高宽比≤3（高宽比>2时须侧向稳定措施）。",
    profession: "template",
    structure_type: "门式",
    trigger_materials: "门架,跨距,列距",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 128-2019",
    standard_name: "建筑施工门式钢管脚手架安全技术标准",
    clause_no: "6.4.3",
    clause_title: "水平加固杆设置（I级）",
    clause_text:
      "安全等级为I级的满堂支撑架，水平加固杆：平行于门架平面的应在架体顶部和沿高度方向不大于2步、外侧水平方向间隔不大于2个跨距各设置一道；垂直于门架平面的应在架体顶部和沿高度方向不大于2步、外侧水平方向间隔不大于2个列距各设置一道。水平加固杆端部宜设置连墙件与建筑结构连接。",
    audit_points:
      "核对门式支撑架水平加固杆（I级）：顶部+沿高≤2步、外侧水平≤2跨距（平行）/≤2列距（垂直）各一道；端部宜连墙。须先确认安全等级。",
    profession: "template",
    structure_type: "门式",
    trigger_materials: "水平加固杆,加固杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 128-2019",
    standard_name: "建筑施工门式钢管脚手架安全技术标准",
    clause_no: "6.4.5",
    clause_title: "门式支撑架竖向剪刀撑（I级）",
    clause_text:
      "安全等级为I级的满堂支撑架竖向剪刀撑：平行于门架平面的应在架体外侧和水平间隔不大于4个跨距各设置一道，每道均应连续设置；垂直于门架平面的应在架体外侧和水平间隔不大于4个列距各设置一道，每道竖向剪刀撑的宽度宜为4个跨距。",
    audit_points:
      "核对门式支撑架竖向剪刀撑（I级）：平行门架平面外侧水平≤4跨距、垂直门架平面≤4列距各一道、连续设置、每道宽约4跨距。须先确认安全等级。",
    profession: "template",
    structure_type: "门式",
    trigger_materials: "剪刀撑,竖向剪刀撑",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ═────────────────────────────────────────────────────────────────══
  // 脚手架专业（profession="scaffolding"）
  // 数据来源：方案审核依据/.../2危大工程专项方案/4脚手架工程
  //   GB55023-2022 施工脚手架通用规范（强制性，通用锚点）
  //   JGJ 130-2011 扣件式钢管脚手架（落地式作业脚手架 + 型钢悬挑脚手架）
  //   JGJ 202-2010 工具式脚手架（附着式升降脚手架/爬架 + 高处作业吊篮）
  //   JGJ 80-2016 高处作业（卸料平台/操作平台限载）
  // 构造轴与模板专业不同：模板按"连接方式"(轮扣/盘扣/扣件/碗扣/套扣/门式)，
  //   脚手架按"架体形式"(落地式/悬挑式/附着升降式/吊篮/卸料平台)，两轴不相交，不互窜。
  // ═────────────────────────────────────────────────────────────────══

  // ── 落地式作业脚手架（JGJ 130-2011 单双排外架）3 条 ──
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.1.2",
    clause_title: "搭设高度限值（单/双排）",
    clause_text:
      "单排脚手架搭设高度不应超过24m；双排脚手架搭设高度不宜超过50m，高度超过50m的双排脚手架，应采用分段搭设等措施。",
    audit_points:
      "核对落地式外脚手架搭设高度：单排≤24m（不应）、双排≤50m（不宜）。双排>50m 须分段搭设。注意单排架不得用于24m以上。",
    profession: "scaffolding",
    structure_type: "落地式脚手架",
    trigger_materials: "立杆,单排,双排",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.3.4",
    clause_title: "底层步距限值",
    clause_text: "单、双排脚手架底层步距均不应大于2m。",
    audit_points:
      "核对落地式外脚手架底层步距≤2m（不应）。底层步距过大会显著降低立杆承载力。",
    profession: "scaffolding",
    structure_type: "落地式脚手架",
    trigger_materials: "立杆,横杆,步距",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.3.3",
    clause_title: "立杆基础高差与边坡距离",
    clause_text:
      "脚手架立杆基础不在同一高度上时，必须将高处的纵向扫地杆向低处延长两跨与立杆固定，高低差不应大于1m。靠边坡上方的立杆轴线到边坡的距离不应小于500mm。",
    audit_points:
      "核对落地式外脚手架地基：基础有高差时纵向扫地杆须向低处延长两跨、高低差≤1m、靠边坡立杆轴线距边坡≥500mm。方案地基整平与排水须落实。",
    profession: "scaffolding",
    structure_type: "落地式脚手架",
    trigger_materials: "立杆,扫地杆,地基,基础",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 悬挑式脚手架（JGJ 130-2011 §6.10 型钢悬挑）5 条 ──
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.10.1",
    clause_title: "一次悬挑高度限值",
    clause_text: "一次悬挑脚手架高度不宜超过20m。",
    audit_points:
      "核对型钢悬挑脚手架分段高度：每段悬挑高度≤20m（不宜）。超过20m应重新分段锚固，不得超段搭设。",
    profession: "scaffolding",
    structure_type: "悬挑式脚手架",
    trigger_materials: "型钢,悬挑梁,悬挑",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.10.2",
    clause_title: "型钢悬挑梁规格与锚固",
    clause_text:
      "型钢悬挑梁宜采用双轴对称截面的型钢。悬挑钢梁型号及锚固件应按设计确定，钢梁截面高度不应小于160mm。悬挑梁尾端应在两处及以上固定于钢筋混凝土梁板结构上。锚固型钢悬挑梁的U形钢筋拉环或锚固螺栓直径不宜小于16mm。",
    audit_points:
      "核对型钢悬挑梁四项：①宜双轴对称截面（工字钢）；②截面高度≥160mm（不应）；③尾端≥两处固定于梁板结构；④U形拉环/锚固螺栓直径≥16mm（不宜）。方案未明确型钢型号或截面<160mm即不符。",
    profession: "scaffolding",
    structure_type: "悬挑式脚手架",
    trigger_materials: "型钢,悬挑梁,U形拉环,锚固螺栓,工字钢",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.10.4",
    clause_title: "钢丝绳/钢拉杆斜拉（卸荷）",
    clause_text:
      "每个型钢悬挑梁外端宜设置钢丝绳或钢拉杆与上一层建筑结构斜拉结。钢丝绳、钢拉杆不参与悬挑钢梁受力计算；钢丝绳与建筑结构拉结的吊环应使用HPB235级钢筋，其直径不宜小于20mm，吊环预埋锚固长度应符合现行国家标准《混凝土结构设计规范》GB50010中钢筋锚固的规定。",
    audit_points:
      "核对悬挑梁外端卸荷：①宜设钢丝绳/钢拉杆与上层结构斜拉；②钢丝绳/钢拉杆不参与钢梁受力计算（仅供安全储备）；③吊环直径≥20mm（不宜）、HPB235级、预埋锚固长度符合GB50010。",
    profession: "scaffolding",
    structure_type: "悬挑式脚手架",
    trigger_materials: "钢丝绳,钢拉杆,吊环,悬挑梁",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.10.5",
    clause_title: "悬挑梁固定段长度与锚固件数量",
    clause_text:
      "悬挑钢梁悬挑长度应按设计确定，固定段长度不应小于悬挑段长度的1.25倍。型钢悬挑梁固定端应采用2个(对)及以上U形钢筋拉环或锚固螺栓与建筑结构梁板固定，U形钢筋拉环或锚固螺栓应预埋至混凝土梁、板底层钢筋位置，并应与混凝土梁、板底层钢筋焊接或绑扎牢固。",
    audit_points:
      "核对悬挑梁锚固：①固定段长度≥悬挑段1.25倍（不应）；②固定端≥2个(对)U形拉环/锚固螺栓；③拉环/螺栓预埋至梁板底层钢筋位置并与主筋焊接/绑扎。方案固定段<悬挑段1.25倍严重违规。",
    profession: "scaffolding",
    structure_type: "悬挑式脚手架",
    trigger_materials: "悬挑梁,U形拉环,锚固螺栓,固定段",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 130-2011",
    standard_name: "建筑施工扣件式钢管脚手架安全技术规范",
    clause_no: "6.10.8",
    clause_title: "锚固位置楼板厚度",
    clause_text:
      "锚固位置设置在楼板上时，楼板的厚度不宜小于120mm。如果楼板的厚度小于120mm应采取加固措施。",
    audit_points:
      "核对悬挑梁锚固楼层楼板厚度：≥120mm（不宜）；<120mm须加固（如增设加固筋/承重垫板）。方案在薄板上直接锚固未加固即不符。",
    profession: "scaffolding",
    structure_type: "悬挑式脚手架",
    trigger_materials: "楼板,锚固,悬挑梁",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 附着升降式脚手架/爬架（JGJ 202-2010 §4.5 + GB55023 §4.4.9）5 条 ──
  {
    standard_code: "JGJ 202-2010",
    standard_name: "建筑施工工具式脚手架安全技术规范",
    clause_no: "4.5.1",
    clause_title: "三类安全装置强制设置",
    clause_text: "附着式升降脚手架必须具有防倾覆、防坠落和同步升降控制的安全装置。",
    audit_points:
      "核对爬架三类安全装置齐备：防倾覆、防坠落、同步升降控制，缺一不可「必须」。方案/设备清单缺任一类装置即严重违规。",
    profession: "scaffolding",
    structure_type: "附着升降式脚手架",
    trigger_materials: "防倾覆装置,防坠落装置,同步控制装置,安全装置",
    trigger_processes: "安装,搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 202-2010",
    standard_name: "建筑施工工具式脚手架安全技术规范",
    clause_no: "4.5.2",
    clause_title: "防倾覆装置",
    clause_text:
      "防倾覆装置中应包括导轨和两个以上与导轨连接的可滑动的导向件；在防倾导向件的范围内应设置防倾覆导轨，且应与竖向主框架可靠连接；在升降和使用两种工况下，最上和最下两个导向件之间的最小间距不得小于2.8m或架体高度的1/4；应采用螺栓与附墙支座连接，其装置与导轨之间的间隙应小于5mm。",
    audit_points:
      "核对爬架防倾覆：①含导轨+≥2个可滑动导向件；②导轨与竖向主框架可靠连接；③最上最下导向件间距≥2.8m或架体高度1/4（升降+使用两工况）；④螺栓与附墙支座连接、与导轨间隙<5mm。",
    profession: "scaffolding",
    structure_type: "附着升降式脚手架",
    trigger_materials: "防倾覆装置,导轨,导向件,附墙支座",
    trigger_processes: "安装,搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 202-2010",
    standard_name: "建筑施工工具式脚手架安全技术规范",
    clause_no: "4.5.3",
    clause_title: "防坠落装置",
    clause_text:
      "防坠落装置应设置在竖向主框架处并附着在建筑结构上，每一升降点不得少于一个防坠落装置，防坠落装置在使用和升降工况下都必须起作用；防坠落装置必须采用机械式的全自动装置，严禁使用每次升降都需重组的手动装置；防坠落装置与升降设备必须分别独立固定在建筑结构上；钢吊杆式防坠落装置，钢吊杆规格应由计算确定，且不应小于φ25mm。整体式升降脚手架制动距离≤80mm，单片式≤150mm。",
    audit_points:
      "核对爬架防坠落：①设在竖向主框架处、每升降点≥1个；②使用+升降两工况都起作用；③必须机械式全自动（严禁手动重组）；④与升降设备分别独立固定；⑤钢吊杆≥φ25mm；⑥制动距离整体≤80mm/单片≤150mm。",
    profession: "scaffolding",
    structure_type: "附着升降式脚手架",
    trigger_materials: "防坠落装置,竖向主框架,钢吊杆,升降设备",
    trigger_processes: "安装,搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 202-2010",
    standard_name: "建筑施工工具式脚手架安全技术规范",
    clause_no: "4.5.4",
    clause_title: "同步升降控制装置",
    clause_text:
      "附着式升降脚手架升降时，必须配备有限制荷载或水平高差的同步控制系统。当某一机位的荷载超过设计值的15%时应自动报警，超过30%时应能使该升降设备自动停机；水平支承桁架两端高差达到30mm时应能自动停机；不得采用附加重量的措施控制同步。",
    audit_points:
      "核对爬架同步控制：①必须配限制荷载或水平高差同步控制系统；②超载15%声光报警、30%自动停机；③两端高差30mm自动停机；④不得用附加重物控制同步。",
    profession: "scaffolding",
    structure_type: "附着升降式脚手架",
    trigger_materials: "同步控制装置,荷载传感器,升降设备",
    trigger_processes: "安装,搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 55023-2022",
    standard_name: "施工脚手架通用规范",
    clause_no: "4.4.9",
    clause_title: "附着式升降脚手架构造（附墙支座）",
    clause_text:
      "附着式升降脚手架应符合下列规定：竖向主框架、水平支承桁架应采用桁架或刚架结构，杆件应采用焊接或螺栓连接；应设有防倾、防坠、停层、荷载、同步升降控制装置，各类装置应灵敏可靠；在竖向主框架所覆盖的每个楼层均应设置一道附墙支座，每道附墙支座应能承担竖向主框架的全部荷载。",
    audit_points:
      "核对爬架构造：①竖向主框架/水平支承桁架为桁架或刚架、焊接或螺栓连接；②防倾/防坠/停层/荷载/同步五类装置齐备灵敏；③竖向主框架覆盖范围内每个楼层设一道附墙支座、每道承担全部主框架荷载。",
    profession: "scaffolding",
    structure_type: "附着升降式脚手架",
    trigger_materials: "附墙支座,竖向主框架,水平支承桁架",
    trigger_processes: "安装,搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 高处作业吊篮（JGJ 202-2010 §5）4 条 ──
  {
    standard_code: "JGJ 202-2010",
    standard_name: "建筑施工工具式脚手架安全技术规范",
    clause_no: "5.5.1",
    clause_title: "安全绳与安全锁扣",
    clause_text:
      "高处作业吊篮应设置作业人员专用的挂设安全带的安全绳及安全锁扣。安全绳应固定在建筑物可靠位置上，不得与吊篮上任何部位有连接。安全绳应符合现行国家标准《安全带》GB6095的要求，其直径应与安全锁扣的规格相一致。",
    audit_points:
      "核对吊篮安全绳：①必须设作业人员专用安全绳+安全锁扣；②安全绳固定在建筑物可靠位置、严禁与吊篮任何部位连接（关键：绳必须独立于吊篮）；③符合GB6095、绳径与锁扣规格一致。",
    profession: "scaffolding",
    structure_type: "吊篮",
    trigger_materials: "安全绳,安全锁扣,安全带,吊篮",
    trigger_processes: "安装,搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 202-2010",
    standard_name: "建筑施工工具式脚手架安全技术规范",
    clause_no: "5.4.10",
    clause_title: "配重件设置",
    clause_text:
      "配重件应稳定可靠地安放在配重架上，并应有防止随意移动的措施。严禁使用破损的配重件或其他替代物。配重件的重量应符合设计规定。",
    audit_points:
      "核对吊篮配重：①稳定安放在配重架、有防移动措施；②严禁使用破损配重件或替代物；③配重重量符合设计规定。方案以沙袋/混凝土块等替代标准配重即违规。",
    profession: "scaffolding",
    structure_type: "吊篮",
    trigger_materials: "配重,配重架,吊篮",
    trigger_processes: "安装,搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 202-2010",
    standard_name: "建筑施工工具式脚手架安全技术规范",
    clause_no: "5.4.7",
    clause_title: "前支架支撑位置禁令",
    clause_text: "悬挂机构前支架严禁支撑在女儿墙上、女儿墙外或建筑物挑檐边缘。",
    audit_points:
      "核对吊篮悬挂机构前支架位置：严禁支撑在女儿墙上、女儿墙外、挑檐边缘「严禁」。方案前支架落在女儿墙/挑檐即严重违规。",
    profession: "scaffolding",
    structure_type: "吊篮",
    trigger_materials: "前支架,悬挂机构,女儿墙,挑檐",
    trigger_processes: "安装,搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 202-2010",
    standard_name: "建筑施工工具式脚手架安全技术规范",
    clause_no: "5.4.12",
    clause_title: "多悬挂机构吊点间距",
    clause_text:
      "当使用两个以上的悬挂机构时，悬挂机构吊点水平间距与吊篮平台的吊点间距应相等，其误差不应大于50mm。",
    audit_points:
      "核对多悬挂机构吊篮：悬挂机构吊点水平间距=吊篮平台吊点间距，误差≤50mm。误差过大导致吊篮受力偏心。",
    profession: "scaffolding",
    structure_type: "吊篮",
    trigger_materials: "悬挂机构,吊点,吊篮平台",
    trigger_processes: "安装,搭设",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 卸料平台（JGJ 80-2016 §6.1 操作平台）2 条 ──
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.1.4",
    clause_title: "限载牌与限定作业人数",
    clause_text:
      "应在操作平台明显位置设置标明允许负载值的限载牌及限定允许的作业人数，物料应及时转运，不得超重、超高堆放。",
    audit_points:
      "核对卸料/操作平台限载：①明显位置设限载牌（标明允许负载值）+限定作业人数；②物料及时转运、不得超重超高堆放。方案无限载设计值或现场无限载牌即不符。",
    profession: "scaffolding",
    structure_type: "卸料平台",
    trigger_materials: "限载牌,卸料平台,操作平台,荷载",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 卸料/操作平台通用锚点（JGJ 80-2016，structure_type=null 以兼容"悬挑外架+卸料平台"混合方案）──
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.1.1",
    clause_title: "操作平台设计计算与专项方案",
    clause_text:
      "操作平台应通过设计计算,并应编制专项方案,架体构造与材质应满足国家现行相关标准的规定。",
    audit_points:
      "核对卸料/操作平台基本前提：必须有设计计算和专项方案，架体构造、材质应满足现行标准。方案只有搭设做法、无平台结构计算或专项方案即不符。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,悬挑式操作平台",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.1.2",
    clause_title: "操作平台材料与脚手板",
    clause_text:
      "操作平台的架体结构应采用钢管、型钢及其他等效性能材料组装,并应符合现行国家标准《钢结构设计规范》GB50017及国家现行有关脚手架标准的规定。平台面铺设的钢、木或竹胶合板等材质的脚手板,应符合材质和承载力要求,并应平整满铺及可靠固定。",
    audit_points:
      "核对操作平台材料：架体结构采用钢管、型钢或等效材料，平台脚手板应满足材质和承载力要求并平整满铺、可靠固定。方案未明确平台材料或脚手板固定措施即不符。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,型钢,脚手板",
    trigger_processes: null,
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.4.1",
    clause_title: "悬挑式操作平台主体结构支承",
    clause_text:
      "悬挑式操作平台设置应符合下列规定：操作平台的搁置点、拉结点、支撑点应设置在稳定的主体结构上,且应可靠连接；严禁将操作平台设置在临时设施上；操作平台的结构应稳定可靠,承载力应符合设计要求。",
    audit_points:
      "核对悬挑式卸料/操作平台支承：搁置点、拉结点、支撑点必须设置在稳定主体结构上并可靠连接，严禁设在临时设施上，承载力应符合设计要求。方案把支承或拉结落在外架、临设上即严重违规。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,悬挑式操作平台,主体结构,搁置点,拉结点,支撑点",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.4.2",
    clause_title: "悬挑长度、荷载与锚固",
    clause_text:
      "悬挑式操作平台的悬挑长度不宜大于5m,均布荷载不应大于5.5kN/m²,集中荷载不应大于15kN,悬挑梁应锚固固定。",
    audit_points:
      "核对悬挑式卸料/操作平台限值：悬挑长度≤5m（不宜），均布荷载≤5.5kN/m²（不应），集中荷载≤15kN（不应），悬挑梁应锚固固定。方案超限或未说明锚固即不符。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,悬挑梁,悬挑钢梁",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.4.3",
    clause_title: "斜拉钢丝绳承载要求",
    clause_text:
      "采用斜拉方式的悬挑式操作平台,平台两侧的连接吊环应与前后两道斜拉钢丝绳连接,每一道钢丝绳应能承载该侧所有荷载。",
    audit_points:
      "核对斜拉式悬挑卸料平台钢丝绳：平台两侧吊环应与前后两道斜拉钢丝绳连接，且每一道钢丝绳均应能承载该侧所有荷载。方案写成钢丝绳仅作安全储备、不参与平台受力验算即不符。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,悬挑式操作平台,钢丝绳,吊环",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.4.5",
    clause_title: "悬臂梁式平台型钢与节点计算",
    clause_text:
      "采用悬臂梁式的操作平台,应采用型钢制作悬挑梁或悬挑桁架,不得使用钢管,其节点应采用螺栓或焊接的刚性节点。当平台板上的主梁采用与主体结构预埋件焊接时,预埋件、焊缝均应经设计计算,建筑主体结构应同时满足强度要求。",
    audit_points:
      "卸料平台专用。核对悬臂梁式卸料/操作平台：悬挑梁或悬挑桁架应采用型钢，不得使用钢管；节点应为螺栓或焊接刚性节点；预埋件、焊缝和主体结构强度应计算。方案用钢管悬挑或无节点/预埋件计算即不符。该条不用于悬挑外脚手架拉杆节点审查，悬挑脚手架本体优先引用JGJ 130。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,型钢,悬挑梁,预埋件,焊缝,主体结构",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.4.6",
    clause_title: "吊环与吊运连接",
    clause_text:
      "悬挑式操作平台应设置4个吊环,吊运时应使用卡环,不得使吊钩直接钩挂吊环。吊环应按通用吊环或起重吊环设计,并应满足强度要求。",
    audit_points:
      "核对悬挑式卸料/操作平台吊运：应设置4个吊环，吊运时使用卡环，不得用吊钩直接钩挂吊环；吊环应按通用吊环或起重吊环设计并满足强度。方案吊环数量不足或吊钩直挂即不符。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,吊环,卡环,吊钩",
    trigger_processes: null,
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.4.7",
    clause_title: "钢丝绳夹连接数量",
    clause_text:
      "悬挑式操作平台安装时,钢丝绳应采用专用的钢丝绳夹连接,钢丝绳夹数量应与钢丝绳直径相匹配,且不得少于4个。建筑物锐角、利口周围系钢丝绳处应加衬软垫物。",
    audit_points:
      "核对悬挑式卸料平台钢丝绳连接：应采用专用钢丝绳夹，数量与直径匹配且不少于4个；锐角、利口处应加衬软垫物。方案绳夹少于4个或无防割保护即不符。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,钢丝绳,钢丝绳夹",
    trigger_processes: null,
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "6.4.10",
    clause_title: "悬挑式操作平台结构计算",
    clause_text: "悬挑式操作平台的结构设计计算应符合本规范附录C的规定。",
    audit_points:
      "核对悬挑式卸料/操作平台计算书：结构设计计算应按JGJ 80-2016附录C执行，不能只给构造做法或套用外脚手架计算书。方案缺少平台主梁、次梁、钢丝绳或斜撑验算即不符。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,悬挑式操作平台,钢丝绳,悬挑梁",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 80-2016",
    standard_name: "建筑施工高处作业安全技术规范",
    clause_no: "C.0.4",
    clause_title: "钢丝绳拉力与安全系数验算",
    clause_text:
      "钢丝绳验算应符合下列规定：钢丝绳应按公式计算所受拉力标准值；钢丝绳的拉力应按公式验算钢丝绳的安全系数K，[K]取值为10。",
    audit_points:
      "核对悬挑式卸料平台钢丝绳验算：应计算钢丝绳拉力标准值，并验算钢丝绳安全系数K，规范规定安全系数取值为10。方案将钢丝绳作为安全储备而不计算拉力和安全系数即不符。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,操作平台,钢丝绳,安全系数",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 55023-2022",
    standard_name: "施工脚手架通用规范",
    clause_no: "4.4.4",
    clause_title: "作业层脚手板与防护",
    clause_text:
      "脚手架作业层应采取安全防护措施：作业脚手架、附着式升降脚手架作业层应满铺脚手板并稳固可靠，当作业层边缘与结构外表面的距离大于150mm时应采取防护措施；作业脚手架底层脚手板应采取封闭措施；沿所施工建筑物每3层或高度不大于10m处应设置一层水平防护；作业层外侧应采用安全网封闭；脚手板伸出横向水平杆以外的部分不应大于200mm。",
    audit_points:
      "核对脚手架作业层防护：①满铺脚手板稳固；②边缘与结构距离>150mm须防护；③底层脚手板封闭；④每3层或≤10m设一道水平防护；⑤外侧安全网封闭；⑥脚手板伸出横向水平杆≤200mm。",
    profession: "scaffolding",
    structure_type: "卸料平台",
    trigger_materials: "脚手板,安全网,水平防护,防护栏杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 脚手架通用锚点（structure_type=null，靠 materials/processes 跨构造捞）──
  {
    standard_code: "GB 55023-2022",
    standard_name: "施工脚手架通用规范",
    clause_no: "4.4.6",
    clause_title: "作业脚手架连墙件（通用）",
    clause_text:
      "作业脚手架应按设计计算和构造要求设置连墙件，并应符合下列要求：连墙件应采用能承受压力和拉力的刚性构件，并应与工程结构和架体连接牢固；连墙点的水平间距不得超过3跨，竖向间距不得超过3步，连墙点之上架体的悬臂高度不应超过2步；在架体的转角处、开口型作业脚手架端部应增设连墙件，连墙件竖向间距不应大于建筑物层高，且不应大于4m。",
    audit_points:
      "核对作业脚手架连墙件（通用强制）：①必须刚性构件（承受拉力和压力）；②水平间距≤3跨、竖向≤3步、悬臂高度≤2步；③转角/开口型端部增设、竖向≤层高且≤4m。方案采用柔性连墙件或间距超限即违规。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "连墙件,连墙,刚性连墙件",
    trigger_processes: "搭设,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 55023-2022",
    standard_name: "施工脚手架通用规范",
    clause_no: "4.4.7",
    clause_title: "作业脚手架竖向剪刀撑（通用）",
    clause_text:
      "作业脚手架的纵向外侧立面上应设置竖向剪刀撑：每道剪刀撑宽度应为4跨～6跨，且不应小于6m，也不应大于9m，剪刀撑斜杆与水平面的倾角应在45°～60°之间；当搭设高度在24m以下时，应在架体两端、转角及中间每隔不超过15m各设置一道剪刀撑，并应由底至顶连续设置；当搭设高度在24m及以上时，应在全外侧立面上由底至顶连续设置；悬挑脚手架、附着式升降脚手架应在全外侧立面上由底至顶连续设置。",
    audit_points:
      "核对作业脚手架剪刀撑（通用强制）：①每道宽4-6跨且≥6m≤9m、倾角45-60°；②<24m两端转角及每≤15m设一道、底至顶连续；③≥24m全外侧连续；④悬挑/爬架不论高度全外侧底至顶连续。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "剪刀撑,竖向剪刀撑",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 55023-2022",
    standard_name: "施工脚手架通用规范",
    clause_no: "5.2.1",
    clause_title: "搭设同步与自由高度",
    clause_text:
      "脚手架应按顺序搭设：落地作业脚手架、悬挑脚手架的搭设应与主体结构工程施工同步，一次搭设高度不应超过最上层连墙件2步，且自由高度不应大于4m；剪刀撑、斜撑杆等加固杆件应随架体同步搭设；每搭设完一步距架体后，应及时校正立杆间距、步距、垂直度及水平杆的水平度。",
    audit_points:
      "核对脚手架搭设顺序：①与主体结构同步；②一次搭设≤最上层连墙件2步、自由高度≤4m；③剪刀撑/斜撑同步搭设；④每步校正间距/步距/垂直度/水平度。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "连墙件,剪刀撑,立杆",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 55023-2022",
    standard_name: "施工脚手架通用规范",
    clause_no: "5.3.3",
    clause_title: "严禁固定卸料平台/泵管于作业脚手架",
    clause_text:
      "严禁将支撑脚手架、缆风绳、混凝土输送泵管、卸料平台及大型设备的支承件等固定在作业脚手架上。严禁在作业脚手架上悬挂起重设备。",
    audit_points:
      "核对作业脚手架使用：严禁将卸料平台、混凝土输送泵管、缆风绳、大型设备支承件固定在作业脚手架上，严禁悬挂起重设备「严禁」。卸料平台必须独立设置，方案若将泵管/卸料平台固定于外架即严重违规。",
    profession: "scaffolding",
    structure_type: null,
    trigger_materials: "卸料平台,泵管,输送泵管,起重设备",
    trigger_processes: "搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═────────────────────────────────────────────────────────────────══
  // 基坑专业（profession="foundation"）
  // 来源：1基坑工程 文件夹。构造轴=支护方法（排桩/地连墙/土钉墙/锚杆/放坡）+通用
  // ═────────────────────────────────────────────────────────────────══
  // ── 基坑通用（监测/开挖/周边保护）──
  {
    standard_code: "GB55003-2021",
    standard_name: "建筑与市政地基基础通用规范",
    clause_no: "7.4.3",
    clause_title: "基坑开挖与回填",
    clause_text:
      "基坑土方开挖的顺序应与设计工况相一致，严禁超挖；基坑开挖应分层进行，内支撑结构基坑开挖尚应均衡进行；基坑开挖不得损坏支护结构、降水设施和工程桩等；基坑周边施工材料、设施或车辆荷载严禁超过设计要求的地面荷载限值；基坑开挖至坑底标高时，应及时进行坑底封闭，并采取防止水浸、暴露和扰动基底原状土的措施。",
    audit_points:
      "「严禁超挖」「严禁超过地面荷载限值」为强制性；核对方案分层开挖工况与设计一致、坑底封闭措施、地面荷载限值。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "土方,支护结构,支撑,腰梁,降水设施",
    trigger_processes: "开挖,拆除,混凝土浇筑,降水",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB55003-2021",
    standard_name: "建筑与市政地基基础通用规范",
    clause_no: "7.1.5",
    clause_title: "一二级基坑监测强制",
    clause_text:
      "安全等级为一级、二级的支护结构，在基坑开挖过程与支护结构使用期内，必须进行支护结构的水平位移监测和基坑开挖影响范围内建（构）筑物、地面的沉降监测。",
    audit_points:
      "「必须」；一、二级基坑必须做水平位移+沉降监测，影响范围覆盖周边建（构）筑物。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "支护结构,周边建筑,地下管线",
    trigger_processes: "监测,开挖,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB55003-2021",
    standard_name: "建筑与市政地基基础通用规范",
    clause_no: "2.1.1",
    clause_title: "地基基础功能要求",
    clause_text:
      "地基基础应满足下列功能要求：基础应具备将上部结构荷载传递给地基的承载力和刚度；在上部结构的各种作用和作用组合下，地基不得出现失稳；地基基础沉降变形不得影响上部结构功能和正常使用；基坑工程应保证支护结构、周边建（构）筑物、地下管线、道路、城市轨道交通等市政设施的安全和正常使用，并应保证主体地下结构的施工空间和安全。",
    audit_points:
      "「不得出现失稳」「不得影响」为强制性；核对周边管线、道路、轨道交通保护措施。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "支护结构,地下管线,周边建筑,道路",
    trigger_processes: "设计计算,验算,监测",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ180-2009",
    standard_name: "建筑施工土石方工程安全技术规范",
    clause_no: "6.3.2",
    clause_title: "严禁提前开挖超挖",
    clause_text:
      "基坑支护结构必须在达到设计要求的强度后，方可开挖下层土方，严禁提前开挖和超挖。施工过程中，严禁设备或重物碰撞支撑、腰梁、锚杆等基坑支护结构，亦不得在支护结构上放置或悬挂重物。",
    audit_points:
      "「必须」「严禁」强制性；核对下层土方开挖前置条件（支护强度）、防碰撞支撑/腰梁/锚杆措施。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "支护结构,支撑,腰梁,锚杆",
    trigger_processes: "开挖,拆除,混凝土浇筑",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ180-2009",
    standard_name: "建筑施工土石方工程安全技术规范",
    clause_no: "6.3.9",
    clause_title: "基坑边禁止堆载",
    clause_text: "除基坑支护设计允许外，基坑边不得堆土、堆料、放置机具。",
    audit_points:
      "「不得」强制性；无设计允许时基坑边禁止堆土/堆料/机具，明确堆载控制距离与限值。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "土方,材料,施工机具",
    trigger_processes: "开挖,验收,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50497-2019",
    standard_name: "建筑基坑工程监测技术标准",
    clause_no: "8.0.9",
    clause_title: "立即危险报警情形",
    clause_text:
      "当出现下列情况之一时，必须立即进行危险报警，并应通知有关各方对基坑支护结构和周边环境保护对象采取应急措施：1基坑支护结构的位移值突然明显增大或基坑出现流砂、管涌、隆起、陷落等；2基坑支护结构的支撑或锚杆体系出现过大变形、压屈、断裂、松弛或拔出的迹象；3基坑周边建筑的结构部分出现危害结构的变形裂缝；4基坑周边地面出现较严重的突发裂缝或地下空洞、地面下陷；5基坑周边管线变形突然明显增长或出现裂缝、泄漏等。",
    audit_points:
      "「必须立即」报警；应急预案须覆盖流砂/管涌/隆起/支撑断裂/管线泄漏等5种情形。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "支护结构,支撑,锚杆,周边管线,周边建筑",
    trigger_processes: "监测,开挖",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-162-2019",
    standard_name: "建筑基坑施工监测技术标准",
    clause_no: "3.7.3",
    clause_title: "围护体系监测报警值",
    clause_text:
      "监测报警值应根据基坑安全等级和支护形式由基坑工程设计方确定。一级基坑围护结构顶水平位移变化速率2～3mm/d、累计值25～30mm；二级变化速率3～5mm/d、累计值40～50mm；三级变化速率8～10mm/d、累计值60～80mm。支撑内力取荷载设计值或构件承载能力的70%～80%取小值；锚杆（索）拉力取荷载设计值。当监测项目的变化速率连续三次监测值超过表中规定的70%，应报警。",
    audit_points:
      "一/二/三级报警阈值：速率2～3/3～5/8～10mm/d，累计25～30/40～50/60～80mm；连续三次超70%即报警。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "监测点,围护结构,支撑,锚杆",
    trigger_processes: "监测,设计计算,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 排桩支护 ──
  {
    standard_code: "DBJ/T 15-20-2016",
    standard_name: "建筑基坑工程技术规程",
    clause_no: "8.2.7",
    clause_title: "灌注排桩混凝土强度",
    clause_text: "灌注排桩的混凝土强度等级不应低于C25，纵向受力钢筋宜采用HRB400级钢筋。",
    audit_points: "「不应低于C25」；核对灌注桩混凝土等级（≥C25）、纵向筋牌号（HRB400）。",
    profession: "foundation",
    structure_type: "排桩支护",
    trigger_materials: "混凝土,钢筋,灌注桩",
    trigger_processes: "混凝土浇筑,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-20-2016",
    standard_name: "建筑基坑工程技术规程",
    clause_no: "8.3.2",
    clause_title: "排桩施工偏差限值",
    clause_text:
      "桩位偏差不应大于50mm；孔深的偏差应为0mm～+300mm，孔底沉渣厚度不应大于200mm，排桩兼作承重结构时，孔底沉渣厚度不应大于100mm；桩身垂直度不应大于1/150，桩径的偏差应为0mm～+100mm。",
    audit_points:
      "桩位≤50mm、沉渣≤200mm（承重≤100mm）、垂直度≤1/150；核对各项允许偏差表。",
    profession: "foundation",
    structure_type: "排桩支护",
    trigger_materials: "灌注桩,钻孔,沉渣",
    trigger_processes: "验收,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 地下连续墙 ──
  {
    standard_code: "DBJ/T 15-20-2016",
    standard_name: "建筑基坑工程技术规程",
    clause_no: "9.2.6",
    clause_title: "地下连续墙厚度与混凝土",
    clause_text:
      "墙厚应根据计算并结合成槽机械的规格确定，且不应小于600mm；墙体混凝土的强度等级不宜低于C30。",
    audit_points: "墙厚「不应小于600mm」、混凝土「不宜低于C30」。",
    profession: "foundation",
    structure_type: "地下连续墙",
    trigger_materials: "混凝土,导墙,钢筋笼",
    trigger_processes: "混凝土浇筑,验收,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-20-2016",
    standard_name: "建筑基坑工程技术规程",
    clause_no: "5.7.4",
    clause_title: "抗隆起稳定安全系数",
    clause_text:
      "抗隆起稳定安全系数Ks，安全等级为一级、二级、三级的支护结构，Ks分别不应小于1.8、1.6、1.4。",
    audit_points: "Ks一/二/三级分别≥1.8/1.6/1.4；按等级核对验算结果。",
    profession: "foundation",
    structure_type: "地下连续墙",
    trigger_materials: "支护结构,基坑底土",
    trigger_processes: "设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 土钉墙 ──
  {
    standard_code: "GB50739-2011",
    standard_name: "复合土钉墙基坑支护技术规范",
    clause_no: "3.0.4",
    clause_title: "土钉墙基坑深度限值",
    clause_text:
      "软土地层中基坑开挖深度不宜大于6m，其他地层中基坑直立开挖深度不宜大于13m，可放坡时基坑开挖深度不宜大于18m。",
    audit_points: "「不宜大于」三档：软土6m、直立13m、放坡18m；超出须改支护或专项论证。",
    profession: "foundation",
    structure_type: "土钉墙",
    trigger_materials: "土钉,面层,喷射混凝土",
    trigger_processes: "设计计算,开挖,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50739-2011",
    standard_name: "复合土钉墙基坑支护技术规范",
    clause_no: "5.4.3",
    clause_title: "土钉墙面层构造",
    clause_text:
      "面层混凝土强度等级不应低于C20，终凝时间不宜超过4h，厚度宜为80mm～120mm；面层中应配置钢筋网，钢筋网可采用HPB300级钢筋，直径宜为6mm～10mm，间距宜为150mm～250mm，搭接长度不宜小于30倍钢筋直径。",
    audit_points: "面层≥C20、厚80～120mm、钢筋网6～10mm@150～250mm、搭接≥30d。",
    profession: "foundation",
    structure_type: "土钉墙",
    trigger_materials: "喷射混凝土,钢筋网",
    trigger_processes: "混凝土浇筑,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-20-2016",
    standard_name: "建筑基坑工程技术规程",
    clause_no: "10.2.16",
    clause_title: "土钉长度分级",
    clause_text:
      "对于深度大于4m的基坑，土钉长度不宜小于6m；对于深度不大于4m的基坑，土钉长度不宜小于4m。",
    audit_points: "基坑深>4m时土钉≥6m、≤4m时≥4m；核对土钉长度与基坑深度匹配。",
    profession: "foundation",
    structure_type: "土钉墙",
    trigger_materials: "土钉,钢筋",
    trigger_processes: "设计计算,验收",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 锚杆支护 ──
  {
    standard_code: "DBJ/T 15-20-2016",
    standard_name: "建筑基坑工程技术规程",
    clause_no: "14.2.3",
    clause_title: "锚杆自由段长度",
    clause_text:
      "锚杆自由段长度不宜小于5m，且应穿过潜在滑动面不小于1.5m。",
    audit_points:
      "自由段≥5m、穿过滑动面≥1.5m；锚杆排距≥2.0m、水平间距≥1.5m。",
    profession: "foundation",
    structure_type: "锚杆支护",
    trigger_materials: "锚杆,锚具,钢绞线",
    trigger_processes: "设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50086-2015",
    standard_name: "岩土锚杆与喷射混凝土支护工程技术规范",
    clause_no: "4.6.2",
    clause_title: "锚杆锚固段间距",
    clause_text:
      "锚杆锚固段的间距不应小于1.5m，当需锚杆间距小于1.5m时，应将相邻锚杆的倾角调整至相差3°以上。",
    audit_points: "锚固段间距≥1.5m；如需更小，相邻倾角差≥3°。",
    profession: "foundation",
    structure_type: "锚杆支护",
    trigger_materials: "锚杆,锚固段",
    trigger_processes: "设计计算,安装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50086-2015",
    standard_name: "岩土锚杆与喷射混凝土支护工程技术规范",
    clause_no: "12.1.19",
    clause_title: "锚杆验收试验强制",
    clause_text:
      "工程锚杆必须进行验收试验。其中占锚杆总量5%且不少于3根的锚杆应进行多循环张拉验收试验，占锚杆总量95%的锚杆应进行单循环张拉验收试验。",
    audit_points:
      "「必须」强制性；多循环≥总量5%且≥3根，单循环95%；核对验收试验计划与试验单位资质。",
    profession: "foundation",
    structure_type: "锚杆支护",
    trigger_materials: "锚杆,张拉设备",
    trigger_processes: "验收,检查,张拉",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 放坡开挖 ──
  {
    standard_code: "DBJ/T 15-20-2016",
    standard_name: "建筑基坑工程技术规程",
    clause_no: "6.2.3",
    clause_title: "分级放坡过渡平台",
    clause_text:
      "放坡高度大于允许坡高值的边坡，应采用分级放坡并设置过渡平台。土质边坡的过渡平台宽度不宜小于1.0m，岩质边坡的过渡平台宽度不宜小于0.5m。",
    audit_points: "坡高超允许值应分级；土质过渡平台≥1.0m、岩质≥0.5m。",
    profession: "foundation",
    structure_type: "放坡开挖",
    trigger_materials: "土质边坡,岩质边坡,坡面",
    trigger_processes: "开挖,设计计算",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── foundation 核心补充（JGJ 120 安全等级/支护选型/稳定性 + GB 50497 监测项目 + JGJ 111 降水）──
  // 治深基坑「只审格式没审技术」——放坡方案命中少、缺支护选型/稳定性/降水核心（污水池基坑报告暴露）
  {
    standard_code: "JGJ 120-2012",
    standard_name: "建筑基坑支护技术规程",
    clause_no: "3.1.3",
    clause_title: "基坑支护结构安全等级（必须明确）",
    clause_text:
      "基坑支护设计时，应综合考虑基坑周边环境和地质条件的复杂程度、基坑深度等因素，按表3.1.3采用支护结构的安全等级。对同一基坑的不同部位，可采用不同的安全等级。表3.1.3：一级—支护结构失效、土体过大变形对基坑周边环境或主体结构施工安全的影响很严重；二级—影响严重；三级—影响不严重。",
    audit_points:
      "核对方案是否明确基坑支护结构的安全等级（一/二/三级）。判定原则：基坑周边存在受影响的既有住宅/公共建筑/道路/地下管线，或地质条件复杂、缺少相近基坑经验时定一级；破坏不会危及生命、损失轻微时定三级；对大多数基坑定二级。安全等级决定所有稳定性验算的安全系数取值（如嵌固稳定 K_e 一/二/三级≥1.25/1.2/1.15）及构件重要性系数，方案未明确安全等级则后续所有计算无法核验。常见错误：方案通篇未明确安全等级、或等级与基坑深度/周边环境不匹配（如深基坑+紧邻建筑却定三级）。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "安全等级,一级基坑,二级基坑,三级基坑,破坏后果,基坑深度,开挖深度,支护结构,稳定性,边坡,土方开挖",
    trigger_processes: "设计计算,选型",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 120-2012",
    standard_name: "建筑基坑支护技术规程",
    clause_no: "3.3.1",
    clause_title: "支护结构选型（7因素+按表3.3.2）",
    clause_text:
      "支护结构选型时，应综合考虑下列因素：1 基坑深度；2 土的性状及地下水条件；3 基坑周边环境对基坑变形的承受能力及支护结构失效的后果；4 主体地下结构和基础形式及其施工方法、基坑平面尺寸及形状；5 支护结构施工工艺的可行性；6 施工场地条件及施工季节；7 经济指标、环保性能和施工工期。支护结构应按表3.3.2选型。",
    audit_points:
      "核对方案支护结构选型：须综合考虑7因素（基坑深度、土质与地下水、周边环境变形承受能力与失效后果、主体结构形式与施工方法、施工工艺可行性、场地与季节、经济环保工期），并按表3.3.2选择适用类型（支挡式/土钉墙/重力式水泥土墙/放坡等）。常见错误：未说明选型依据、支护形式与基坑深度或土质不匹配（如软土深基坑采用放坡、深基坑采用悬臂无支撑）。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "支护结构,支护形式,排桩,地下连续墙,土钉墙,放坡,内支撑,锚杆,悬臂",
    trigger_processes: "设计计算,选型",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 120-2012",
    standard_name: "建筑基坑支护技术规程",
    clause_no: "4.2.1",
    clause_title: "稳定性验算（嵌固/抗隆起/滑移）",
    clause_text:
      "悬臂式支挡结构的嵌固深度应符合下式嵌固稳定性的要求：E_pk·a_pl/(E_ak·a_al) ≥ K_e；嵌固稳定安全系数K_e，安全等级为一级、二级、三级的悬臂式支挡结构分别不应小于1.25、1.2、1.15。单层锚杆和单层支撑的支挡式结构嵌固深度同样应符合该式（绕支点转动）。深度较大的基坑当嵌固深度较小、土的强度较低时，应进行抗隆起稳定性验算；土钉墙基坑底面下有软土层时应进行坑底隆起稳定性验算。",
    audit_points:
      "核对方案稳定性验算书完整性：①悬臂/单支点支挡结构嵌固稳定（K_e一/二/三级≥1.25/1.2/1.15）；②深度大+嵌固浅+软土时抗隆起稳定性；③土钉墙坑底隆起（坑底下有软土层时）；④整体滑动稳定（圆弧滑动面法）。每项须给计算公式+土压力参数+安全系数核算结果。常见错误：只给结论无完整计算书、漏项（如深基坑漏抗隆起）、安全系数不达标。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "稳定性,抗倾覆,抗滑移,抗隆起,嵌固深度,圆弧滑动,边坡稳定,安全系数",
    trigger_processes: "设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50497-2019",
    standard_name: "建筑基坑工程监测技术标准",
    clause_no: "4.2.1",
    clause_title: "仪器监测项目（按表4.2.1配置）",
    clause_text:
      "土质基坑工程仪器监测项目应根据表4.2.1进行选择。表4.2.1规定的应测项目（一/二/三级基坑）：围护墙（边坡）顶部水平位移、围护墙（边坡）顶部竖向位移、地下水位、周边建筑竖向位移、周边建筑裂缝与地表裂缝、周边管线竖向位移均「应测」；一级基坑尚应测深层水平位移、支撑轴力、锚杆轴力、周边地表竖向位移、立柱竖向位移。",
    audit_points:
      "核对监测项目配置是否按表4.2.1齐全：所有等级基坑必测顶部水平/竖向位移、地下水位、周边建筑与管线位移及裂缝；一级基坑加测深层水平位移、支撑轴力、锚杆轴力、周边地表竖向位移、立柱竖向位移。常见错误：监测项目漏项（如漏深层水平位移、支撑轴力、地下水位、周边管线）、监测项目与基坑安全等级不匹配。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "监测点,水平位移,竖向位移,深层水平位移,支撑轴力,锚杆轴力,地下水位,周边建筑,周边管线,裂缝",
    trigger_processes: "监测",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 111-2016",
    standard_name: "建筑与市政工程地下水控制技术规范",
    clause_no: "4.2.3",
    clause_title: "降水井设计与抽水试验井",
    clause_text:
      "抽水试验井应符合下列规定：1 深度应能控制对工程有影响的含水层；2 抽水试验井宜为完整井；3 井管直径在松散层中不应小于200mm，在基岩中不应小于150mm；4 过滤器结构应符合现行国家标准《供水水文地质勘察规范》GB50027的有关规定；5 沉砂管长度宜为1m～2m；6 水泵置入设计降水深度以下不应少于2m。",
    audit_points:
      "核对降水方案设计：①水文地质参数（含水层厚度、渗透系数K、影响半径R）；②基坑涌水量计算（按本规范附录B）；③单井出水量设计与降水井数量（附录C）；④降水井深度（控制含水层+水泵置设计降水深度以下≥2m）、间距、井管直径（松散层≥200mm/基岩≥150mm）；⑤降水深度满足基坑开挖要求、承压水控制措施。常见错误：降水井布置无涌水量/出水量计算依据、降水深度不足、未区分潜水与承压水。",
    profession: "foundation",
    structure_type: null,
    trigger_materials: "降水,降水井,地下水,涌水量,水位降深,渗透系数,承压水,潜水",
    trigger_processes: "降水,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═────────────────────────────────────────────────────────────────══
  // 起重吊装专业（profession="crane"）
  // 来源：3起重吊装及起重机械安装拆卸工程。构造轴=机械类型（塔吊/施工升降机/物料提升机/流动式起重机）+通用
  // ═════════════════════════════════════════════════════════════════
  // ── 塔式起重机 ──
  {
    standard_code: "JGJ/T 187-2019",
    standard_name: "塔式起重机混凝土基础工程技术标准",
    clause_no: "5.2.2",
    clause_title: "塔吊基础混凝土强度等级",
    clause_text:
      "基础的混凝土强度等级不应低于C30，垫层混凝土强度等级不应低于C20，混凝土垫层厚度不应小于100mm。基础的配筋应符合现行国家标准《混凝土结构设计规范》GB50010的规定，且板式基础最小配筋率不应小于0.15%，梁式基础最小配筋率不应小于0.20%。",
    audit_points:
      "基础≥C30、垫层≥C20、垫层厚≥100mm；板式配筋率≥0.15%、梁式≥0.20%。低于C30即不符。",
    profession: "crane",
    structure_type: "塔式起重机",
    trigger_materials: "塔式起重机,塔吊基础,板式基础,梁式基础,混凝土,钢筋",
    trigger_processes: "设计计算,混凝土浇筑,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 187-2019",
    standard_name: "塔式起重机混凝土基础工程技术标准",
    clause_no: "5.2.1",
    clause_title: "塔吊基础几何高度要求",
    clause_text:
      "基础高度应满足塔机预埋件的抗拔要求，且不宜小于1200mm，不宜采用坡形或台阶形截面的基础。",
    audit_points: "基础高度≥1200mm（不宜）、满足预埋件抗拔；不宜坡形/台阶截面。",
    profession: "crane",
    structure_type: "塔式起重机",
    trigger_materials: "塔式起重机,塔吊基础,预埋件",
    trigger_processes: "设计计算,验算,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ/T 187-2019",
    standard_name: "塔式起重机混凝土基础工程技术标准",
    clause_no: "8.1.3",
    clause_title: "塔吊安装与使用混凝土强度节点",
    clause_text:
      "安装塔机时基础混凝土应达到设计强度的80%以上，塔机运行使用时基础混凝土应达到设计强度的100%。",
    audit_points: "安装时≥设计强度80%、使用时≥100%；核对龄期/同条件试块报告。",
    profession: "crane",
    structure_type: "塔式起重机",
    trigger_materials: "塔式起重机,塔吊基础,混凝土试块,同条件养护",
    trigger_processes: "安装,验收,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB5144-2006",
    standard_name: "塔式起重机安全规程",
    clause_no: "6.2.1",
    clause_title: "塔吊起重力矩限制器",
    clause_text:
      "塔机应安装起重力矩限制器。如设有起重力矩显示装置，则其数值误差不应大于实际值的±5%。",
    audit_points: "「应安装」力矩限制器；显示误差≤±5%；核对标定证书。",
    profession: "crane",
    structure_type: "塔式起重机",
    trigger_materials: "塔式起重机,力矩限制器,安全装置",
    trigger_processes: "安装,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB5144-2006",
    standard_name: "塔式起重机安全规程",
    clause_no: "10.5",
    clause_title: "群塔防碰撞安全距离",
    clause_text:
      "两台塔机之间的最小架设距离应保证处于低位塔机的起重臂端部与另一台塔机的塔身之间至少有2m的距离；处于高位塔机的最低位置的部件（吊钩升至最高点或平衡重的最低部位）与低位塔机中处于最高位置部件之间的垂直距离不应小于2m。",
    audit_points:
      "群塔水平距离≥2m、垂直距离≥2m；核对群塔平面图两个维度。",
    profession: "crane",
    structure_type: "塔式起重机",
    trigger_materials: "塔式起重机,群塔布置,起重臂",
    trigger_processes: "设计计算,安装,监测,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 332-2014",
    standard_name: "建筑塔式起重机安全监控系统应用技术规程",
    clause_no: "3.1.1",
    clause_title: "塔吊安全监控系统强制功能",
    clause_text:
      "塔机安全监控系统应具有对塔机的起重量、起重力矩、起升高度、幅度、回转角度、运行行程信息进行实时监视和数据存储功能。当塔机有运行危险趋势时，塔机控制回路电源应能自动切断。",
    audit_points:
      "「应」监视6项参数（重量/力矩/高度/幅度/回转角/行程）并存储；危险趋势自动切断电源。本条为强制性条文。",
    profession: "crane",
    structure_type: "塔式起重机",
    trigger_materials: "塔式起重机,安全监控系统,传感器",
    trigger_processes: "安装,验收,监测,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 196-2010",
    standard_name: "建筑施工塔式起重机安装、使用、拆卸安全技术规程",
    clause_no: "4.0.3",
    clause_title: "严禁用限位代替操纵机构",
    clause_text:
      "塔式起重机的力矩限制器、重量限制器、变幅限位器、行走限位器、高度限位器等安全保护装置不得随意调整和拆除，严禁用限位装置代替操纵机构。",
    audit_points:
      "5类安全保护装置「不得随意调整和拆除」；「严禁」用限位代替操纵机构。",
    profession: "crane",
    structure_type: "塔式起重机",
    trigger_materials: "塔式起重机,力矩限制器,重量限制器,限位器",
    trigger_processes: "检查,验收,拆除",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 施工升降机 ──
  {
    standard_code: "JGJ 215-2010",
    standard_name: "建筑施工升降机安装、使用、拆卸安全技术规程",
    clause_no: "4.1.7",
    clause_title: "升降机防坠安全器标定期",
    clause_text:
      "施工升降机必须安装防坠安全器。防坠安全器应在一年有效标定期内使用。",
    audit_points: "「必须安装」防坠安全器；一年有效标定期内使用；超期严禁使用。",
    profession: "crane",
    structure_type: "施工升降机",
    trigger_materials: "施工升降机,防坠安全器,标定证书",
    trigger_processes: "安装,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 215-2010",
    standard_name: "建筑施工升降机安装、使用、拆卸安全技术规程",
    clause_no: "5.3.6",
    clause_title: "升降机坠落试验周期",
    clause_text:
      "施工升降机使用期间，每3个月应进行不少于一次的额定载重量坠落试验。坠落试验的方法、时间间隔及评定标准应符合使用说明书和现行国家标准《施工升降机》GB/T 10054的有关要求。",
    audit_points: "「每3个月」至少一次额定载重量坠落试验；核对坠落试验记录周期。",
    profession: "crane",
    structure_type: "施工升降机",
    trigger_materials: "施工升降机,坠落试验记录,防坠安全器",
    trigger_processes: "检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 215-2010",
    standard_name: "建筑施工升降机安装、使用、拆卸安全技术规程",
    clause_no: "5.2.10",
    clause_title: "严禁用限位作停止开关",
    clause_text: "严禁用行程限位开关作为停止运行的控制开关。",
    audit_points: "「严禁」用行程限位开关作停止控制开关。",
    profession: "crane",
    structure_type: "施工升降机",
    trigger_materials: "施工升降机,行程限位开关",
    trigger_processes: "检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 物料提升机 ──
  {
    standard_code: "JGJ 88-2010",
    standard_name: "龙门架及井架物料提升机安全技术规范",
    clause_no: "11.0.3",
    clause_title: "物料提升机严禁载人",
    clause_text: "物料提升机严禁载人。",
    audit_points: "「严禁载人」绝对禁止；使用管理须明确「只送物料不送人」、设楼层停层装置与警示标志。",
    profession: "crane",
    structure_type: "物料提升机",
    trigger_materials: "物料提升机,龙门架,井架",
    trigger_processes: "验收,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 88-2010",
    standard_name: "龙门架及井架物料提升机安全技术规范",
    clause_no: "5.4.3",
    clause_title: "提升吊笼钢丝绳规格",
    clause_text: "提升吊笼钢丝绳直径不应小于12mm，安全系数不应小于8。",
    audit_points: "钢丝绳直径≥12mm、安全系数≥8；两项缺一不可。",
    profession: "crane",
    structure_type: "物料提升机",
    trigger_materials: "物料提升机,钢丝绳,吊笼",
    trigger_processes: "设计计算,安装,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 88-2010",
    standard_name: "龙门架及井架物料提升机安全技术规范",
    clause_no: "4.1.10",
    clause_title: "物料提升机附墙间距",
    clause_text: "物料提升机自由端高度不宜大于6m；附墙架间距不宜大于6m。",
    audit_points: "自由端高度≤6m、附墙架间距≤6m；超6m须专门设计验算。",
    profession: "crane",
    structure_type: "物料提升机",
    trigger_materials: "物料提升机,附墙架,导轨架",
    trigger_processes: "设计计算,安装,验算,附墙",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 流动式起重机 ──
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "4.1.4",
    clause_title: "流动式起重机支腿要求",
    clause_text:
      "起重机工作时的停放位置应按施工方案与沟渠、基坑保持安全距离，且作业时不得停放在斜坡上。作业前应将支腿全部伸出，并应支垫牢固。调整支腿应在无载荷时进行，并将起重臂全部缩回转至正前或正后，方可调整。作业过程中发现支腿沉陷或其他不正常情况时，应立即放下吊物，进行调整后，方可继续作业。",
    audit_points:
      "停放按方案与沟渠基坑保持安全距离、不得停斜坡；支腿全部伸出+支垫牢固；调整支腿须无载荷+臂缩回转至正前/后。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "流动式起重机,汽车吊,履带吊,支腿,垫板",
    trigger_processes: "吊装,设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "3.0.15",
    clause_title: "双机抬吊载荷分配",
    clause_text:
      "当采用双机抬吊时，宜选用同类型或性能相近的起重机，负载分配应合理，单机载荷不得超过额定起重量的80%，两机应协调工作，起吊的速度应平稳缓慢。",
    audit_points: "宜同类型/性能相近；「单机载荷≤额定起重量80%」；起吊平稳缓慢；须附两机载荷分配计算书。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "流动式起重机,双机抬吊,构件",
    trigger_processes: "吊装,设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "3.0.12",
    clause_title: "六级以上大风停止吊装",
    clause_text:
      "大雨、雾、大雪及六级以上大风等恶劣天气应停止吊装作业。雨雪后进行吊装作业时，应及时清理冰雪并应采取防滑和防漏电措施，先试吊，确认制动器灵敏可靠后方可进行作业。",
    audit_points: "大雨/雾/大雪/六级以上大风「应停止吊装」；雨雪后清冰+防滑防漏电+先试吊确认制动。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "流动式起重机,风速仪,制动器",
    trigger_processes: "吊装,检查,监测",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 起重通用（钢丝绳/吊钩/资质）──
  {
    standard_code: "GB5144-2006",
    standard_name: "塔式起重机安全规程",
    clause_no: "5.3.2",
    clause_title: "吊钩报废5种情形",
    clause_text:
      "吊钩禁止补焊，有下列情况之一的应予以报废：a）用20倍放大镜观察表面有裂纹；b）钩尾和螺纹部分等危险截面及钩筋有永久性变形；c）挂绳处截面磨损量超过原高度的10%；d）心轴磨损量超过其直径的5%；e）开口度比原尺寸增加15%。",
    audit_points:
      "吊钩「禁止补焊」；5项之一即报废：裂纹、危险截面永久变形、挂绳处截面磨损>原高度10%、心轴磨损>直径5%、开口度增加>15%。",
    profession: "crane",
    structure_type: null,
    trigger_materials: "吊钩,起重吊钩,心轴",
    trigger_processes: "检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 5972-2023",
    standard_name: "起重机 钢丝绳 保养、维护、检验和报废",
    clause_no: "6.4.1",
    clause_title: "钢丝绳直径减小报废",
    clause_text:
      "纤维芯单层股钢丝绳直径均匀减小量Q≥10%时报废；钢芯单层股钢丝绳或平行捻密实钢丝绳Q≥7.5%时报废；阻旋转钢丝绳Q≥5%时报废。",
    audit_points:
      "按结构判定：纤维芯Q≥10%、钢芯Q≥7.5%、阻旋转Q≥5%即报废。",
    profession: "crane",
    structure_type: null,
    trigger_materials: "钢丝绳,阻旋转钢丝绳,纤维芯钢丝绳,钢芯钢丝绳",
    trigger_processes: "检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建设部令第166号",
    standard_name: "建筑起重机械安全监督管理规定",
    clause_no: "第二十五条",
    clause_title: "特种作业人员持证上岗",
    clause_text:
      "建筑起重机械安装拆卸工、起重信号工、起重司机、司索工等特种作业人员应当经建设主管部门考核合格，并取得特种作业操作资格证书后，方可上岗作业。",
    audit_points:
      "4类人员（安拆工/信号工/起重司机/司索工）须考核合格+取得特种作业操作资格证方可上岗；核对名单与资格证有效期。",
    profession: "crane",
    structure_type: null,
    trigger_materials: "特种作业操作资格证,建筑起重机械,安拆工,起重司机,司索工,信号工",
    trigger_processes: "安装,拆卸,吊装,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═════════════════════════════════════════════════════════════════
  // 拆除爆破专业（profession="demolition"）
  // 来源：5拆除、爆破工程。构造轴=拆除方式（人工/机械/爆破）+通用
  // ═════════════════════════════════════════════════════════════════
  // ── 人工拆除 ──
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.1.1",
    clause_title: "人工拆除顺序(强制性)",
    clause_text:
      "人工拆除施工应从上至下逐层拆除，并应分段进行，不得垂直交叉作业。当框架结构采用人工拆除施工时，应按楼板、次梁、主梁、结构柱的顺序依次进行。",
    audit_points:
      "「自上而下逐层、分段」；框架按「楼板→次梁→主梁→结构柱」；「不得垂直交叉作业」强制性。",
    profession: "demolition",
    structure_type: "人工拆除",
    trigger_materials: "施工组织设计,专项施工方案,拆除方案",
    trigger_processes: "拆除",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.1.2",
    clause_title: "水平构件严禁聚集(强制性)",
    clause_text:
      "当进行人工拆除作业时，水平构件上严禁人员聚集或集中堆放物料，作业人员应在稳定的结构或脚手架上操作。",
    audit_points: "「严禁人员聚集或集中堆放物料」强制性；作业平台须在稳定结构或脚手架上。",
    profession: "demolition",
    structure_type: "人工拆除",
    trigger_materials: "施工组织设计,脚手架方案,材料堆放方案",
    trigger_processes: "拆除,搭设",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.1.3",
    clause_title: "墙体严禁掏掘推倒(强制性)",
    clause_text: "当人工拆除建筑墙体时，严禁采用底部掏掘或推倒的方法。",
    audit_points: "「严禁底部掏掘或推倒」强制性；凡出现底部掏凿/牵引推倒/底部切断即违规。",
    profession: "demolition",
    structure_type: "人工拆除",
    trigger_materials: "施工组织设计,专项施工方案",
    trigger_processes: "拆除",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.1.5",
    clause_title: "梁悬挑构件下落控制",
    clause_text: "当拆除梁或悬挑构件时，应采取有效的控制下落措施。",
    audit_points: "梁、悬挑构件拆除须有「控制下落措施」（缆绳牵引/限位支撑/防坠棚）。",
    profession: "demolition",
    structure_type: "人工拆除",
    trigger_materials: "施工组织设计,专项施工方案",
    trigger_processes: "拆除,吊装",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 机械拆除 ──
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.2.2",
    clause_title: "机械拆除顺序(强制性)",
    clause_text:
      "当采用机械拆除建筑时，应从上至下逐层拆除，并应分段进行；应先拆除非承重结构，再拆除承重结构。",
    audit_points: "「自上而下逐层、分段、先非承重后承重」强制性；先动承重柱/墙即重大违规。",
    profession: "demolition",
    structure_type: "机械拆除",
    trigger_materials: "施工组织设计,专项施工方案,机械选型表",
    trigger_processes: "拆除",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.2.3",
    clause_title: "机械作业高度要求",
    clause_text:
      "当采用机械拆除建筑时，机械设备前端工作装置的作业高度应超过拟拆除物的高度。",
    audit_points: "机械前端工作装置最大作业高度须「大于拟拆除物高度」。",
    profession: "demolition",
    structure_type: "机械拆除",
    trigger_materials: "施工组织设计,机械设备技术参数表",
    trigger_processes: "拆除,验收",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.2.6",
    clause_title: "双机起吊载荷限值",
    clause_text:
      "当拆除作业采用双机同时起吊同一构件时，每台起重机载荷不得超过允许载荷的80%，且应对第一吊次进行试吊作业，施工中两台起重机应同步作业。",
    audit_points: "「每台起重机≤允许载荷80%」；核对双机抬吊计算书、试吊记录、同步指挥。",
    profession: "demolition",
    structure_type: "机械拆除",
    trigger_materials: "吊装专项方案,起重机允许载荷表,吊装计算书",
    trigger_processes: "吊装,拆除",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.2.9",
    clause_title: "人机禁止同作业面",
    clause_text: "当机械拆除需人工拆除配合时，人员与机械不得在同一作业面上同时作业。",
    audit_points: "「人机不得在同一作业面上同时作业」；核对作业面划分、警戒隔离、指挥信号。",
    profession: "demolition",
    structure_type: "机械拆除",
    trigger_materials: "施工组织设计,专项施工方案",
    trigger_processes: "拆除",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 爆破拆除 ──
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.3.4",
    clause_title: "爆破有害效应执行GB6722",
    clause_text:
      "当采用爆破拆除时，爆破震动、空气冲击波、个别飞散物等有害效应的安全允许标准，应按现行国家标准《爆破安全规程》GB6722执行。",
    audit_points: "须分别核定「振动、冲击波、个别飞散物」三项有害效应；安全距离按GB6722第13章取最大值。",
    profession: "demolition",
    structure_type: "爆破拆除",
    trigger_materials: "爆破专项方案,安全评估报告,GB6722",
    trigger_processes: "爆破,设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.3.7",
    clause_title: "爆破防护覆盖与验收",
    clause_text:
      "当爆破拆除施工时，应按设计要求进行防护和覆盖，起爆前应由现场负责人检查验收；防护材料应有一定的重量和抗冲击能力，应透气、易于悬挂并便于连接固定。",
    audit_points: "防护覆盖材料（草袋/竹笆/橡胶片）须有重量、抗冲击、透气、易悬挂；起爆前现场负责人检查验收签字。",
    profession: "demolition",
    structure_type: "爆破拆除",
    trigger_materials: "爆破专项方案,防护覆盖设计,防护材料清单",
    trigger_processes: "爆破,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "5.3.9",
    clause_title: "安全警戒与盲炮检查",
    clause_text:
      "爆破拆除应设置安全警戒，安全警戒的范围应符合设计要求。爆破后应对盲炮、爆堆、爆破拆除效果以及对周围环境的影响等进行检查，发现问题应及时处理。",
    audit_points: "警戒范围须符合设计；爆后检查须含「盲炮、爆堆、效果、周边影响」四项；盲炮按GB6722 6.9处理。",
    profession: "demolition",
    structure_type: "爆破拆除",
    trigger_materials: "爆破专项方案,警戒布置图,爆后检查表",
    trigger_processes: "爆破,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB6722-2014",
    standard_name: "爆破安全规程",
    clause_no: "13.1.1",
    clause_title: "爆破安全允许距离取值",
    clause_text:
      "爆破地点与人员和其他保护对象之间的安全允许距离，应按各种爆破有害效应(地震波、冲击波、个别飞散物等)分别核定，并取最大值。",
    audit_points: "须按「地震波、冲击波、个别飞散物」分别核算后「取最大值」；只给单一距离或未取最大值即不合规。",
    profession: "demolition",
    structure_type: "爆破拆除",
    trigger_materials: "爆破专项方案,安全允许距离计算书,周边保护对象清单",
    trigger_processes: "爆破,设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB6722-2014",
    standard_name: "爆破安全规程",
    clause_no: "13.6.1",
    clause_title: "个别飞散物对人员安全距离",
    clause_text:
      "一般工程爆破个别飞散物对人员的安全距离不应小于表10的规定；对设备或建(构)物的安全允许距离，应由设计确定。",
    audit_points:
      "对照GB6722表10：浅孔破大块300m、浅孔台阶200m（复杂地质/未形成台阶≥300m）、深孔台阶按设计≤200m、硐室按设计≤300m；沿山坡下坡方向增大50%。",
    profession: "demolition",
    structure_type: "爆破拆除",
    trigger_materials: "爆破专项方案,飞散物安全距离计算书,警戒布置图",
    trigger_processes: "爆破,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB6722-2014",
    standard_name: "爆破安全规程",
    clause_no: "6.9.1.5",
    clause_title: "盲炮严禁强行拉出药包",
    clause_text: "严禁强行拉出炮孔中的起爆药包和雷管。",
    audit_points:
      "「严禁」强制性；盲炮处理须采用重新起爆/平行孔/注水失效/回收雷管等GB6722 6.9规定方法。",
    profession: "demolition",
    structure_type: "爆破拆除",
    trigger_materials: "爆破专项方案,盲炮处理预案,应急预案",
    trigger_processes: "爆破,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB6722-2014",
    standard_name: "爆破安全规程",
    clause_no: "6.9.1.2",
    clause_title: "盲炮处理人员资质",
    clause_text:
      "应派有经验的爆破员处理盲炮，硐室爆破的盲炮处理应由爆破工程技术人员提出方案并经单位技术负责人批准。",
    audit_points: "盲炮处理须「派有经验的爆破员」；硐室爆破盲炮须爆破工程技术人员提方案+单位技术负责人批准。",
    profession: "demolition",
    structure_type: "爆破拆除",
    trigger_materials: "爆破专项方案,盲炮处理预案,爆破作业人员名单",
    trigger_processes: "爆破,检查",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GA991-2012",
    standard_name: "爆破作业项目管理要求",
    clause_no: "5.2.2.1",
    clause_title: "爆破公告提前1天",
    clause_text:
      "爆破作业单位应在爆破前1天发布爆破公告。爆破公告应包括爆破地点、每次爆破时间、安全警戒范围、警戒标志、起爆信号等主要内容。",
    audit_points: "「爆破前1天」发布；公告含「地点、时间、警戒范围、警戒标志、起爆信号」5要素。",
    profession: "demolition",
    structure_type: "爆破拆除",
    trigger_materials: "爆破公告,施工公告,爆破作业合同",
    trigger_processes: "爆破,验收",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GA53-2015",
    standard_name: "爆破作业人员资格条件和管理要求",
    clause_no: "7.1.3",
    clause_title: "爆破员安全员保管员禁兼任",
    clause_text: "爆破员、安全员和保管员不得兼任。",
    audit_points:
      "「爆破员、安全员、保管员不得兼任」强制性；三岗须由不同人员持证上岗。",
    profession: "demolition",
    structure_type: "爆破拆除",
    trigger_materials: "爆破作业人员名单,爆破作业人员许可证",
    trigger_processes: "爆破,验收",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ── 拆除通用 ──
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "3.0.6",
    clause_title: "拆除工程基本顺序",
    clause_text:
      "拆除工程施工应先切断电源、水源和气源，再拆除设备管线设施及主体结构；主体结构拆除宜先拆除非承重结构及附属设施，再拆除承重结构。",
    audit_points: "顺序：「先断水电气→再拆设备管线→再拆主体」；主体「先非承重后承重」。",
    profession: "demolition",
    structure_type: null,
    trigger_materials: "施工组织设计,管线资料,专项施工方案",
    trigger_processes: "拆除",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "3.0.7",
    clause_title: "严禁立体交叉作业",
    clause_text: "拆除工程施工不得立体交叉作业。",
    audit_points: "「不得立体交叉作业」；同一垂直空间内同时存在两个及以上作业层即违规。",
    profession: "demolition",
    structure_type: null,
    trigger_materials: "施工组织设计,专项施工方案,作业平面布置图",
    trigger_processes: "拆除",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 147-2016",
    standard_name: "建筑拆除工程安全技术规范",
    clause_no: "6.0.3",
    clause_title: "安全技术交底(强制性)",
    clause_text:
      "拆除工程施工前，必须对施工作业人员进行书面安全技术交底，且应有记录并签字确认。",
    audit_points: "「书面安全技术交底+记录+签字确认」强制性；口头交底或事后补签均违规。",
    profession: "demolition",
    structure_type: null,
    trigger_materials: "安全技术交底记录,施工组织设计,专项施工方案",
    trigger_processes: "拆除,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═════════════════════════════════════════════════════════════════
  // 暗挖专业（profession="underground"）
  // 来源：6暗挖工程。构造轴=施工工法（盾构/顶管/矿山/冻结）+通用
  // ═════════════════════════════════════════════════════════════════
  // ── 盾构法 ──
  {
    standard_code: "GB50446-2017",
    standard_name: "盾构法隧道施工及验收规范",
    clause_no: "7.5.2",
    clause_title: "土压平衡盾构掘进参数",
    clause_text:
      "应根据隧道工程地质和水文地质条件、埋深、线路平面与坡度、地表环境、施工监测结果、盾构姿态以及始发掘进阶段的经验，设定盾构刀盘转速、掘进速度和土仓压力等掘进参数。",
    audit_points:
      "掘进参数「必须」根据地质/埋深/监测/姿态综合设定；试掘进50m~200m段调整后参数留有记录。",
    profession: "underground",
    structure_type: "盾构法",
    trigger_materials: "盾构掘进专项施工方案,盾构机选型及参数表",
    trigger_processes: "掘进,监测,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50446-2017",
    standard_name: "盾构法隧道施工及验收规范",
    clause_no: "7.8.6",
    clause_title: "气压作业开挖仓压力",
    clause_text: "气压作业前, 开挖仓内气压必须通过计算和试验确定。",
    audit_points:
      "「必须」通过计算和试验确定开挖仓气压（缺一不可）；附计算书与试验记录。",
    profession: "underground",
    structure_type: "盾构法",
    trigger_materials: "开仓作业专项方案,带压进仓作业指导书",
    trigger_processes: "掘进,检查,监测",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50446-2017",
    standard_name: "盾构法隧道施工及验收规范",
    clause_no: "9.1.4",
    clause_title: "管片拼装机严禁站人",
    clause_text: "拼装管片时, 拼装机作业范围内严禁站人和穿行。",
    audit_points: "「严禁」零容忍；拼装回转半径内不得站人/穿行，设专职指挥+警戒+声光报警。",
    profession: "underground",
    structure_type: "盾构法",
    trigger_materials: "管片拼装作业指导书,拼装安全专项方案",
    trigger_processes: "拼装,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50446-2017",
    standard_name: "盾构法隧道施工及验收规范",
    clause_no: "10.2.5",
    clause_title: "同步注浆充填系数",
    clause_text:
      "同步注浆和即时注浆的注浆量充填系数应根据地层条件、施工状态和环境要求确定,充填系数宜为1.30～2.50。",
    audit_points:
      "同步注浆充填系数宜为1.30~2.50；<1.30易沉降、>2.50分析窜浆/堵管；注浆压力、量须自动记录。",
    profession: "underground",
    structure_type: "盾构法",
    trigger_materials: "壁后注浆专项方案,同步注浆配合比设计书",
    trigger_processes: "注浆,监测,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "CJJ217-2014",
    standard_name: "盾构法开仓及气压作业技术规范",
    clause_no: "3.0.5",
    clause_title: "严禁仓外转动刀盘(强条)",
    clause_text:
      "严禁仓外作业人员进行转动刀盘、出渣、泥浆循环等危及仓内作业人员安全的操作。",
    audit_points:
      "强制性条文；「严禁」仓外人员转动刀盘/出渣/泥浆循环——开挖仓有人时所有动作必须锁定；设联锁装置与作业票。",
    profession: "underground",
    structure_type: "盾构法",
    trigger_materials: "开仓作业专项方案,安全作业票",
    trigger_processes: "检查,掘进",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "CJJ217-2014",
    standard_name: "盾构法开仓及气压作业技术规范",
    clause_no: "5.2.4",
    clause_title: "初次开仓保压试验",
    clause_text: "初次开仓前应进行保压试验, 且保压时间不小于2h。",
    audit_points: "初次开仓前「必须」保压试验，保压时间≥2h；附试验记录与气压作业工作压力计算书。",
    profession: "underground",
    structure_type: "盾构法",
    trigger_materials: "开仓保压试验报告,气压作业专项方案",
    trigger_processes: "检查,验收,监测",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 顶管法 ──
  {
    standard_code: "DBJ/T 15-106-2015",
    standard_name: "顶管技术规程（广东省）",
    clause_no: "9.4.2",
    clause_title: "泥水平衡顶进泥水压力",
    clause_text:
      "顶进前应检查泥水压力，泥水压力应控制在高出地下水压力20kPa～40kPa。先内循环，微调泥水压力待稳定正常后，再外循环正常顶进。",
    audit_points: "泥水压力「应」高出地下水压力20~40kPa；过低失稳、过高冒浆；循环泥浆粘度22s~35s。",
    profession: "underground",
    structure_type: "顶管法",
    trigger_materials: "泥水平衡顶管专项方案,泥水压力计算书",
    trigger_processes: "掘进,监测,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-106-2015",
    standard_name: "顶管技术规程（广东省）",
    clause_no: "9.5.1",
    clause_title: "土压平衡顶进出土量",
    clause_text:
      "初始顶进时，出土量宜为理论出土量的95%。正常顶进时，出土量应控制在理论出土量的98%～100%。",
    audit_points: "初始顶进约95%、正常98%~100%；超量引发地表沉降/坍塌；泥土仓土压力比主动土压力大10~30kPa。",
    profession: "underground",
    structure_type: "顶管法",
    trigger_materials: "土压平衡顶管专项方案,出土量记录表",
    trigger_processes: "掘进,监测,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-106-2015",
    standard_name: "顶管技术规程（广东省）",
    clause_no: "9.6.1",
    clause_title: "禁用人工掘进顶管情形",
    clause_text:
      "下列情况下不得采用人工掘进顶管：1穿越的土层为不能自稳的流砂、流泥、涌水地层时；2穿越河流、水塘等水域时。",
    audit_points: "「不得」——流砂/流泥/涌水地层、穿越水域严禁人工掘进顶管；工法比选须先排除人工掘进。",
    profession: "underground",
    structure_type: "顶管法",
    trigger_materials: "顶管工程地质勘察报告,顶管施工方案",
    trigger_processes: "开挖,掘进,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 矿山法 ──
  {
    standard_code: "GB50086-2015",
    standard_name: "岩土锚杆与喷射混凝土支护工程技术规范",
    clause_no: "6.1.2",
    clause_title: "喷射混凝土强度与厚度",
    clause_text:
      "喷射混凝土的设计强度等级不应低于C20;用于大型洞室及特殊条件下的工程支护时,其设计强度等级不宜低于C25。喷射混凝土厚度设计应满足隧洞洞室工程稳定要求及对不稳定危石冲切效应的抗力要求,最小设计厚度不得小于50mm。",
    audit_points: "喷射混凝土≥C20（大型/特殊不宜低于C25）；最小厚度≥50mm；大断面应采用湿拌喷射法。",
    profession: "underground",
    structure_type: "矿山法",
    trigger_materials: "喷射混凝土配合比设计书,初期支护施工方案",
    trigger_processes: "支护,混凝土浇筑,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50086-2015",
    standard_name: "岩土锚杆与喷射混凝土支护工程技术规范",
    clause_no: "4.1.4",
    clause_title: "永久锚杆地层限制(强条)",
    clause_text:
      "永久性锚杆的锚固段不得设置在未经处理的有机质土层、液限ωL大于50%的土层或相对密实度Dr小于0.3的土层中。",
    audit_points:
      "强制性条文；永久锚杆锚固段「不得」设于：有机质土、液限>50%、相对密实度<0.3 三类地层。",
    profession: "underground",
    structure_type: "矿山法",
    trigger_materials: "岩土工程勘察报告,锚杆设计计算书",
    trigger_processes: "设计计算,验算,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "TB 10304-2020",
    standard_name: "铁路隧道工程施工安全技术规程",
    clause_no: "8.1.3",
    clause_title: "围岩较差地段初喷封闭",
    clause_text: "围岩较差地段，爆破找顶后应立即初喷混凝土封闭围岩，必要时封闭掌子面。",
    audit_points:
      "围岩较差地段爆破找顶后「应立即」初喷封闭、必要时封闭掌子面；强调时效，滞后易坍塌。",
    profession: "underground",
    structure_type: "矿山法",
    trigger_materials: "隧道开挖与支护专项方案,围岩级别评价资料",
    trigger_processes: "开挖,爆破,支护,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 冻结法 ──
  {
    standard_code: "NB/T 10222-2019",
    standard_name: "隧道联络通道冻结法施工及验收规范",
    clause_no: "5.2.5-2",
    clause_title: "冻结壁平均温度",
    clause_text:
      "冻结壁平均温度应根据冻结壁承受荷载大小(或开挖深度)、盐水温度、冻结孔间距、冻结壁厚度、冻结管直径、冻结时间等综合确定。联络通道冻结壁平均温度的选取宜符合表5.2.5-1的规定。冻结壁与隧道管片交界面平均温度不应高于-5℃。",
    audit_points:
      "开挖深度Hj<12m取-8~-6℃、12~30m取-10~-8℃、>30m取≤-10℃；「交界面平均温度不应高于-5℃」；附温度场计算与测温孔布置。",
    profession: "underground",
    structure_type: "冻结法",
    trigger_materials: "冻结法专项施工方案,冻结壁设计计算书,温度监测方案",
    trigger_processes: "冻结,监测,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "NB/T 10222-2019",
    standard_name: "隧道联络通道冻结法施工及验收规范",
    clause_no: "5.2.5-3",
    clause_title: "积极冻结期盐水温度",
    clause_text:
      "积极冻结7d后盐水温度宜降至-18℃以下。积极冻结15d后盐水温度应降至-24℃以下。开挖时盐水温度应降至设计最低盐水温度以下，在保证冻结壁平均温度、冻土与结构交界面温度和厚度达到设计要求且实测判定冻结壁安全的情况下，可适当提高盐水温度，但不宜高于-25℃。",
    audit_points:
      "时间—温度双控：7d盐水≤-18℃、15d盐水≤-24℃；开挖前降至设计最低值；维护冻结不宜高于-25℃。",
    profession: "underground",
    structure_type: "冻结法",
    trigger_materials: "积极冻结期降温计划,盐水温度监测记录",
    trigger_processes: "冻结,监测,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "NB/T 10222-2019",
    standard_name: "隧道联络通道冻结法施工及验收规范",
    clause_no: "6.6.4",
    clause_title: "开挖期不得停止供冷",
    clause_text:
      "在开挖期间不得擅自停止或减少冻结孔供冷。如在积极冻结期间发生短暂停冻, 应按停冻时间的2倍相应延长积极冻结时间; 如确因施工需要停止个别冻结孔供冷时, 应分析对冻结壁整体稳定性的影响, 并制定相应技术措施, 确保开挖和结构施工安全。",
    audit_points:
      "「不得」擅自停止/减少供冷；停冻须按2倍时间延长积极冻结期；停个别孔须分析冻结壁整体稳定性；有备用电源/泵。",
    profession: "underground",
    structure_type: "冻结法",
    trigger_materials: "冻结法施工方案,冻结停复冻应急预案",
    trigger_processes: "冻结,监测,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ── 暗挖通用（监测/风险/通风/预报）──
  {
    standard_code: "GB50911-2013",
    standard_name: "城市轨道交通工程监测技术规范",
    clause_no: "9.1.5",
    clause_title: "监测预警警情报送(强条)",
    clause_text:
      "城市轨道交通工程监测应根据工程特点、监测项目控制值、当地施工经验等制定监测预警等级和预警标准。城市轨道交通工程施工过程中,当监测数据达到预警标准时,必须进行警情报送。",
    audit_points:
      "强制性条文；「必须」制定预警等级（黄/橙/红=控制值70%/85%/100%）并执行警情报送。",
    profession: "underground",
    structure_type: null,
    trigger_materials: "施工监测方案,监测预警管理制度",
    trigger_processes: "监测,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50911-2013",
    standard_name: "城市轨道交通工程监测技术规范",
    clause_no: "表9.2.2-2",
    clause_title: "盾构法地表沉降控制值",
    clause_text:
      "盾构法隧道地表沉降监测项目控制值（按监测等级）：一级（中软~软弱土）累计值15~25mm、变化速率3mm/d；二级累计值25~35mm、变化速率4mm/d；三级累计值35~45mm、变化速率5mm/d。地表隆起累计值10mm、变化速率3mm/d。矿山法区间一级累计值20~30mm、车站40~60mm。",
    audit_points:
      "盾构沉降按等级：一级15~25mm、二级25~35mm、三级35~45mm；地表隆起累计10mm；矿山法车站可达40~60mm。",
    profession: "underground",
    structure_type: null,
    trigger_materials: "施工监测方案,地表沉降控制值清单",
    trigger_processes: "监测,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB50652-2011",
    standard_name: "城市轨道交通地下工程建设风险管理规范",
    clause_no: "4.3.1",
    clause_title: "工程建设风险等级四级",
    clause_text:
      "根据风险发生的可能性和风险损失,工程建设风险等级标准宜分为四级。Ⅰ级风险接受准则为不可接受,必须采取风险控制措施降低风险,至少应将风险降低至可接受或不愿接受的水平,应编制风险预警与应急处置方案。Ⅱ级为不愿接受,应实施风险防范与监测。Ⅲ级为可接受,宜加强日常管理与监测。Ⅳ级为可忽略。",
    audit_points:
      "风险四级；Ⅰ级「不可接受」必须编制风险预警与应急处置方案；Ⅱ级须防范与监测；Ⅲ级以上须记录名称/位置/等级/监控指标/控制方案。",
    profession: "underground",
    structure_type: null,
    trigger_materials: "工程建设风险评估报告,风险等级清单,专项应急预案",
    trigger_processes: "设计计算,验算,检查,监测",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "TB 10304-2020",
    standard_name: "铁路隧道工程施工安全技术规程",
    clause_no: "11.5.5",
    clause_title: "隧道施工通风供风量",
    clause_text:
      "隧道施工过程中，应保障持续通风，保证每一作业人员供应新鲜空气不小于3m³/min，采用内燃机械作业时，供风量不应小于3m³/(min·kW)。隧道全断面开挖时的通风风速不应小于0.15m/s，分部开挖的坑道中通风风速不应小于0.25m/s。",
    audit_points:
      "持续通风+每人≥3m³/min+内燃机械≥3m³/(min·kW)；风速全断面≥0.15m/s、分部开挖≥0.25m/s。",
    profession: "underground",
    structure_type: null,
    trigger_materials: "隧道施工通风专项方案,通风设备配置清单",
    trigger_processes: "检查,监测",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "TB 10304-2020",
    standard_name: "铁路隧道工程施工安全技术规程",
    clause_no: "5.0.2",
    clause_title: "超前地质预报作为工序",
    clause_text:
      "隧道施工应开展超前地质预报工作，作为工序纳入施工组织管理。隧道施工应编制超前地质预报专项方案，施工前应进行安全技术交底。超前地质预报工作前应确认工作区域无掉块、掌子面溜坍等安全风险。",
    audit_points:
      "超前地质预报「应」开展并「作为工序」纳入施工组织；编制专项方案+施工前安全交底。",
    profession: "underground",
    structure_type: null,
    trigger_materials: "超前地质预报专项方案,施工组织设计",
    trigger_processes: "检查,监测",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═══════════════════════════════════════════════════════════════════
  // 人工挖孔桩专业（profession="pile"，全 structure_type=null）
  // 来源：8人工挖孔桩工程。无稳定构造轴，靠 MATERIAL_KEYWORDS 识别方案。
  // 注：trigger_processes 置 null，只靠 niche 材料词匹配，避免与别专业串。
  // ═══════════════════════════════════════════════════════════════════
  {
    standard_code: "粤建管字〔2003〕49号",
    standard_name: "关于限制使用人工挖孔灌注桩的通知",
    clause_no: "一",
    clause_title: "挖孔桩禁用地层条件",
    clause_text:
      "挖孔开挖工作面以下，有下列情况之一者，不得使用挖孔桩：（一）地基土中分布有厚度超过2m的流塑状泥或厚度超过4m的软塑状土；（二）地下水位以下有层厚超过2m的松散、稍密的砂层或层厚超过3m的中密、密实砂层；（三）溶岩地区；（四）有涌水的地质断裂带；（五）地下水丰富，采取措施后仍无法避免边抽水边作业；（六）高压缩性人工杂填土厚度超过5m；（七）工作面3m以下土层中有腐植质有机物、煤层等可能存在有毒气体的土层；（八）孔深超过25m或桩径小于1.2m；（九）没有可靠的安全措施，可能对周围建（构）筑物、道路、管线等造成危害。",
    audit_points:
      "「禁用九条」逐项核对勘察报告：①流塑泥>2m或软塑土>4m；②地下水位下松散稍密砂层>2m或中密密实砂层>3m；③溶岩区；④涌水断裂带；⑤富水且无法避免边抽水边作业；⑥杂填土>5m；⑦工作面3m以下含腐植质/煤层等毒气源；⑧孔深>25m或桩径<1.2m；⑨周边无可靠保护措施。命中任一即不得采用挖孔桩。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "人工挖孔桩,挖孔灌注桩,地质勘察,地层,地下水,溶岩,杂填土",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "粤建管字〔2003〕49号",
    standard_name: "关于限制使用人工挖孔灌注桩的通知",
    clause_no: "三(一)(二)(三)",
    clause_title: "护壁厚度强度与日掘进限值",
    clause_text:
      "护壁必须由设计单位设计，护壁厚度不得小于150mm；护壁混凝土强度等级不得低于C20；采用混凝土护壁时，每天掘进深度不得大于1m；护壁混凝土不得人工拌合，每节护壁均须由监理单位验收。",
    audit_points:
      "①护壁厚度≥150mm（广东底线，严于国标100mm）；②混凝土强度≥C20；③每天掘进≤1m；④不得人工拌合，必须机械拌合；⑤每节护壁监理验收。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "人工挖孔桩,护壁,混凝土",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "粤建管字〔2003〕49号",
    standard_name: "关于限制使用人工挖孔灌注桩的通知",
    clause_no: "三(四)",
    clause_title: "孔内作业安全通风与气体检测",
    clause_text:
      "孔内作业时，上下井必须有可靠安全保障措施，严禁乘坐吊桶上下。须配备通讯设备（如对讲机）保证上下通讯畅顺。施工中应有可靠通风措施，同时应配备有毒气检验测仪器，定时进行气体检测。",
    audit_points:
      "「严禁乘坐吊桶上下」——必须设硬爬梯/软爬梯；核对：①通讯设备；②可靠通风措施；③有毒气检验测仪器；④定时气体检测（每日开工前+作业中）。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "人工挖孔桩,孔内提升,气体检测,通风设备,吊桶",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "粤建管字〔2003〕49号",
    standard_name: "关于限制使用人工挖孔灌注桩的通知",
    clause_no: "三(五)",
    clause_title: "禁止孔内边抽水边作业",
    clause_text: "禁止孔内边抽水边作业。",
    audit_points:
      "「禁止边抽水边作业」——孔内有人作业时不得同时抽水；降水须采用场地外降水或施工前完成；方案出现「边抽水边挖」即违规。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "人工挖孔桩,降水,潜水泵,地下水",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 94-2008",
    standard_name: "建筑桩基技术规范",
    clause_no: "6.6.7",
    clause_title: "挖孔桩安全措施与送风要求",
    clause_text:
      "人工挖孔桩施工应采取下列安全措施：1孔内必须设置应急软爬梯供人员上下；使用的电葫芦、吊笼等应安全可靠，并配有自动卡紧保险装置，不得使用麻绳和尼龙绳吊挂或脚踏井壁凸缘上下；电葫芦宜用按钮式开关，使用前必须检验其安全起吊能力；2每日开工前必须检测井下的有毒、有害气体，并应有相应的安全防范措施；当桩孔开挖深度超过10m时，应有专门向井下送风的设备，风量不宜少于25L/s；3孔口四周必须设置护栏，护栏高度宜为0.8m；4挖出的土石方应及时运离孔口，不得堆放在孔口周边1m范围内，机动车辆的通行不得对井壁的安全造成影响。",
    audit_points:
      "①应急软爬梯；②电葫芦/吊笼自动卡紧保险装置；③不得使用麻绳/尼龙绳；④每日开工前气体检测；⑤孔深>10m必须送风、风量≥25L/s；⑥孔口护栏0.8m；⑦孔口1m范围内不得堆土。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "人工挖孔桩,软爬梯,电葫芦,吊笼,送风设备,气体检测仪",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 94-2008",
    standard_name: "建筑桩基技术规范",
    clause_no: "6.6.13",
    clause_title: "桩身混凝土灌注串筒要求",
    clause_text:
      "灌注桩身混凝土时，混凝土必须通过溜槽；当落距超过3m时，应采用串筒，串筒末端距孔底高度不宜大于2m；也可采用导管泵送；混凝土宜采用插入式振捣器振实。",
    audit_points:
      "①混凝土必须通过溜槽；②落距>3m时必须采用串筒；③串筒末端距孔底≤2m防离析；④优先插入式振捣器振实。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "桩身混凝土,溜槽,串筒,导管,人工挖孔桩",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 94-2008",
    standard_name: "建筑桩基技术规范",
    clause_no: "6.6.14",
    clause_title: "严禁边抽水边开挖或灌注邻桩",
    clause_text:
      "当渗水量过大时，应采取场地截水、降水或水下灌注混凝土等有效措施。严禁在桩孔中边抽水边开挖，同时不得灌注相邻桩。",
    audit_points:
      "两条硬禁令：①严禁桩孔中边抽水边开挖（防涌水涌砂塌孔）；②渗水量大时不得灌注相邻桩（防动水稀释混凝土）。降水改场地外降水或水下灌注。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "人工挖孔桩,降水,地下水,桩身混凝土",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 94-2008",
    standard_name: "建筑桩基技术规范",
    clause_no: "4.1.3",
    clause_title: "扩底桩扩底端尺寸构造",
    clause_text:
      "扩底灌注桩扩底端尺寸应符合下列规定：1对于持力层承载力较高、上覆土层较差的抗压桩和桩端以上有一定厚度较好土层的抗拔桩，可采用扩底；扩底端直径与桩身直径之比D/d，应根据承载力要求及扩底端侧面和桩端持力层土性特征以及扩底施工方法确定；挖孔桩的D/d不应大于3，钻孔桩的D/d不应大于2.5；2扩底端侧面的斜率应根据实际成孔及土体自立条件确定，a/hc可取1/4~1/2，砂土可取1/4，粉土、黏性土可取1/3~1/2；3抗压桩扩底端底面宜呈锅底形，矢高hb可取(0.15~0.20)D。",
    audit_points:
      "挖孔桩扩底D/d≤3；侧面斜率a/hc=1/4~1/2（砂土取1/4）；锅底矢高hb=(0.15~0.20)D。扩底尺寸须经设计计算并符合土体自立条件。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "扩底,扩底灌注桩,持力层,人工挖孔桩",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-152-2019",
    standard_name: "建筑地基基础施工规范(广东)",
    clause_no: "17.3.7",
    clause_title: "挖孔桩桩径孔深与间隔开挖",
    clause_text:
      "人工挖孔灌注桩成孔施工应符合下列规定：2人工挖孔桩的桩径应不小于1.2m，孔深应不大于25m；3人工挖孔桩的桩净距小于2.5m时，应间隔开挖和间隔灌注，且排桩相邻最小施工净距应不小于4.5m；4挖土次序宜先中间后周边，扩底部分应先挖桩身圆柱体，再按扩底尺寸从上而下进行；5终孔条件满足设计要求后，应清除护壁上的泥土、孔底残渣和积水；7渗水量过大时，应采取场地截水、降水或水下灌注混凝土等有效措施，严禁在桩孔中边抽水边开挖。",
    audit_points:
      "广东地标严于国标：①桩径≥1.2m（国标0.8m）；②孔深≤25m（国标30m）；③净距<2.5m间隔开挖间隔灌注；④排桩相邻最小施工净距≥4.5m；⑤严禁边抽水边开挖。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "人工挖孔桩,扩底,降水,护壁",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-152-2019",
    standard_name: "建筑地基基础施工规范(广东)",
    clause_no: "17.3.8",
    clause_title: "护壁每节高度与构造要求",
    clause_text:
      "人工挖孔灌注桩护壁施工应符合下列规定：1混凝土护壁每节高度宜为900mm~1000mm，当可能出现涌土涌砂情况时，每节护壁高度可减小至300mm~500mm，护壁的厚度应不小于150mm，混凝土强度等级不应低于C20；2上下节护壁的搭接长度不得小于50mm；3第一节井圈护壁中心线与设计轴线的偏差应不大于20mm；4第一节井圈顶面应高于场地地面150mm~200mm，壁厚应比下面井壁厚度增加100mm~150mm；5混凝土护壁应配置直径不小于8mm的构造钢筋，竖向筋应上下搭接或拉接；6每节护壁应在当日连续施工完毕；8护壁模板的拆除应在灌注混凝土24h之后；10同一水平面上的井圈直径极差应不大于50mm。",
    audit_points:
      "①每节高度900~1000mm（涌土涌砂时300~500mm）；②厚度≥150mm、强度≥C20；③搭接≥50mm；④第一节中心偏差≤20mm、高于地面150~200mm、壁厚+100~150mm；⑤构造筋≥φ8；⑥每节当日连续施工；⑦拆模≥24h；⑧直径极差≤50mm。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "护壁,混凝土,模板,构造钢筋,井圈,人工挖孔桩",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-152-2019",
    standard_name: "建筑地基基础施工规范(广东)",
    clause_no: "17.3.9",
    clause_title: "孔内施工安全送风量与照明",
    clause_text:
      "人工挖孔灌注桩施工安全应符合下列规定：1孔内应设置应急硬爬梯。使用的电葫芦和吊笼等应安全可靠，并应配有自动卡紧保险装置。电葫芦宜用按钮式开关，使用前应检验其安全起吊能力；2施工中的桩孔应设置半圆形安全防护板，暂停施工时应加盖盖板或钢管网片；4每日开工前应检测井下的有毒气体，桩孔开挖深度超过5m时，应有专门向井下送风的设备，送风量不宜少于25L/s；5护壁应高于地面200mm，孔口四周应设置安全护栏，护栏高度宜为1.2m；6桩身混凝土终凝前，相邻10m范围内应停止挖孔作业，孔底不得留人；7孔内作业照明应采用12V以下的安全灯。",
    audit_points:
      "广东地标严于国标：①孔深>5m即送风（国标10m）、风量≥25L/s；②应急硬爬梯；③12V以下安全灯；④暂停施工加盖盖板/钢管网片；⑤护壁高于地面200mm+护栏1.2m；⑥桩身混凝土终凝前相邻10m停挖孔、孔底不得留人。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "硬爬梯,电葫芦,吊笼,送风设备,气体检测仪,安全护栏,12V安全灯,人工挖孔桩",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 106-2014",
    standard_name: "建筑基桩检测技术规范",
    clause_no: "3.3.3",
    clause_title: "灌注桩完整性检测数量比例",
    clause_text:
      "混凝土桩的桩身完整性检测方法选择，应符合本规范第3.1.1条的规定；当一种方法不能全面评价基桩完整性时，应采用两种或两种以上的检测方法，检测数量应符合下列规定：1建筑桩基设计等级为甲级，或地基条件复杂、成桩质量可靠性较低的灌注桩工程，检测数量不应少于总桩数的30%，且不应少于20根；其他桩基工程，检测数量不应少于总桩数的20%，且不应少于10根；2除符合本条上款规定外，每个柱下承台检测桩数不应少于1根；3大直径嵌岩灌注桩或设计等级为甲级的大直径灌注桩，应在本条第1、2款规定的检测桩数范围内，按不少于总桩数10%的比例采用声波透射法或钻芯法检测。",
    audit_points:
      "①甲级/复杂/低可靠性灌注桩≥30%且≥20根（其他≥20%且≥10根）；②每柱下承台≥1根（含单桩单柱全数检测）；③大直径嵌岩/甲级大直径灌注桩≥10%采用声波透射或钻芯法。",
    profession: "pile",
    structure_type: null,
    trigger_materials: "低应变,声波透射,钻芯法,基桩,人工挖孔桩",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═══════════════════════════════════════════════════════════════════
  // 水下作业专业（profession="underwater"，全 structure_type=null）
  // 来源：10水下作业工程。注：folder 偏"沉管/水下隧道检测+防腐涂料"，
  //   对潜水/水下焊接切割核心规程覆盖不足（缺口已记录）。
  // ═══════════════════════════════════════════════════════════════════
  {
    standard_code: "DBJ/T 15-146-2018",
    standard_name: "内河沉管隧道水下检测技术规范",
    clause_no: "3.0.1",
    clause_title: "水下施工期应实施水下检测",
    clause_text: "内河沉管隧道水下工程施工期间应实施水下检测。",
    audit_points:
      "「应实施」强制；方案必须覆盖水下施工全过程；不得以施工自检或监理复检替代第三方检测；检测单位应具相应能力。",
    profession: "underwater",
    structure_type: null,
    trigger_materials: "水下检测,沉管隧道,水下作业,水下施工,第三方检测",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-146-2018",
    standard_name: "内河沉管隧道水下检测技术规范",
    clause_no: "3.0.8",
    clause_title: "潜水作业须符合潜水安全国标",
    clause_text:
      "涉及潜水作业的水下检测除应符合本规范的规定外,尚应符合现行国家标准《产业潜水最大安全深度》GB/T 12552、《空气潜水安全要求》GB 26123、《潜水员水下用电安全规程》GB 16636的规定。",
    audit_points:
      "凡涉及潜水员水下录像/量测/探摸/取样均须满足 GB/T 12552、GB 26123、GB 16636；核查潜水员资格证书、最大潜水深度、水下用电安全、减压程序。",
    profession: "underwater",
    structure_type: null,
    trigger_materials: "潜水作业,潜水员,潜水设备,水下用电,沉管隧道",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "DBJ/T 15-146-2018",
    standard_name: "内河沉管隧道水下检测技术规范",
    clause_no: "8.3.2",
    clause_title: "GINA止水带沉放前检测",
    clause_text:
      "浮运到位后GINA带检测应符合下列规定:1检测时间应在管节浮运到位后、沉放前3d内;2检测方法宜采用水下录像和水下探摸;3每次管节沉放对接应检测1次;4检测成果除包括GINA止水带表面整洁程度、GINA止水带安装效果外,尚应包括重要部位、损坏部位影像。",
    audit_points:
      "时机「浮运到位后沉放前3d内」；方法「水下录像+水下探摸」双措；每对接必检1次；成果含损坏部位影像。GINA止水带是沉管第一道防水命门。",
    profession: "underwater",
    structure_type: null,
    trigger_materials: "GINA止水带,管节浮运沉放,沉管隧道,水下检测",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 34677-2017",
    standard_name: "水下生产系统防腐涂料",
    clause_no: "4.3.1",
    clause_title: "喷砂基材清洁度与粗糙度",
    clause_text:
      "除另有商定外,按表2的规定选用底材。试验用马口铁板、钢板的材质和处理应符合GB/T9271的规定。喷砂钢板经喷砂处理后,表面清洁度应达到GB/T8923.1—2011中规定的Sa2级,表面粗糙度达到GB/T13288.1—2008中规定的中(G)级。",
    audit_points:
      "喷砂后清洁度「Sa2级」(近白级)；粗糙度达「中(G)」级；涂装前须做表面处理验收，否则附着力失效。",
    profession: "underwater",
    structure_type: null,
    trigger_materials: "水下防腐涂料,喷砂钢板,表面处理,沉管隧道",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 34677-2017",
    standard_name: "水下生产系统防腐涂料",
    clause_no: "表1",
    clause_title: "水下防腐涂料关键性能指标",
    clause_text:
      "表1要求:附着力(拉开法)/MPa≥5;耐浸泡性[(40±2)℃天然海水或人造海水,4200h]指标为单边腐蚀蔓延≤8.0mm,非划线区不起泡、不生锈、不开裂、不剥落;耐阴极剥离性指标为人造漏涂孔处剥离面积的等效直径≤20mm;高压保压循环试验[常压12h,高压(6MPa)12h为一个循环周期,10个周期]涂层不起泡、不生锈、不开裂、不剥落,附着力≥3MPa且降低不超过初始值的50%。",
    audit_points:
      "附着力≥5MPa；耐浸泡4200h且腐蚀蔓延≤8mm；耐阴极剥离等效直径≤20mm；高压保压循环10周期6MPa附着力损失≤50%；任一不合格判整体不合规。",
    profession: "underwater",
    structure_type: null,
    trigger_materials: "水下防腐涂料,型式检验报告,耐浸泡,耐阴极剥离",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JTG/T 3371-2022",
    standard_name: "公路水下隧道设计规范",
    clause_no: "6.4.12",
    clause_title: "水下隧道抗浮安全系数",
    clause_text:
      "钻爆隧道及盾构隧道使用过程中的抗浮安全系数不应小于1.2,在施工过程中的抗浮安全系数不应小于1.1;沉管隧道及堰筑隧道使用过程中抗浮安全系数不应小于1.15,在施工过程中的抗浮安全系数不应小于1.05。对地震液化及其他超设计标准工况进行抗浮校核时,抗浮安全系数可取1.05。",
    audit_points:
      "钻爆/盾构使用阶段≥1.2、施工阶段≥1.1；沉管/堰筑使用阶段≥1.15、施工阶段≥1.05；须按300年一遇洪水位+冲刷组合校核。",
    profession: "underwater",
    structure_type: null,
    trigger_materials: "抗浮计算书,水下隧道,沉管隧道,覆盖层厚度",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JTG/T 3371-2022",
    standard_name: "公路水下隧道设计规范",
    clause_no: "6.6.11",
    clause_title: "防水混凝土厚度裂缝保护层",
    clause_text:
      "水下隧道衬砌结构应采用防水混凝土或防水钢筋混凝土结构。采用防水混凝土的结构应符合下列规定:1结构厚度不应小于250mm。2迎水面裂缝宽度不应大于0.2mm,并不应出现贯通裂缝。3迎水面钢筋的保护层厚度不应小于50mm。",
    audit_points:
      "结构厚度≥250mm；迎水面裂缝≤0.2mm且无贯通裂缝；迎水面保护层≥50mm；同时核查抗渗等级与外水压力设计值匹配。",
    profession: "underwater",
    structure_type: null,
    trigger_materials: "防水混凝土,水下隧道衬砌,抗渗等级,沉管隧道",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JTG/T 3371-2022",
    standard_name: "公路水下隧道设计规范",
    clause_no: "15.4.4",
    clause_title: "结构安全监测频率",
    clause_text:
      "结构安全监测频率应根据隧道所处地质条件、受力条件、设计结果及当地经验等因素确定,应能满足所监测项目的重要变化过程而又不遗漏其变化时刻。无当地经验时,可根据地质条件、受力条件、设计结果及表15.4.4确定。表15.4.4:第一年1次/星期,一年后1次/月,发生异常时2次/天;注:发生台风、沉船、地震等偶然事件时,应按每小时监测一次或根据现场情况确定监测频率。",
    audit_points:
      "第一年≥1次/周；一年后≥1次/月；异常2次/天；台风/沉船/地震每小时1次。",
    profession: "underwater",
    structure_type: null,
    trigger_materials: "结构安全监测,水下隧道,监测预警值,沉管隧道",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═══════════════════════════════════════════════════════════════════
  // 四新专业（profession="new-technology"，全 structure_type=null）
  // 来源：12采用新技术、新工艺、新材料、新设备工程（4 份行政文件）
  // ═══════════════════════════════════════════════════════════════════
  {
    standard_code: "建设部令第109号",
    standard_name: "建设领域推广应用新技术管理规定",
    clause_no: "第三条",
    clause_title: "新技术定义与范围",
    clause_text:
      "本规定所称的新技术，是指经过鉴定、评估的先进、成熟、适用的技术、材料、工艺、产品。本规定所称限制、禁止使用的落后技术，是指已无法满足工程建设、城市建设、村镇建设等领域的使用要求，阻碍技术进步与行业发展，且已有替代技术，需要对其应用范围加以限制或者禁止使用的技术、材料、工艺和产品。",
    audit_points:
      "核对方案声称的「新技术」是否经过省级、部级或国家级鉴定或评估；区分是「新技术」还是「限用/禁用落后技术」；新技术须有鉴定评估文件支撑。",
    profession: "new-technology",
    structure_type: null,
    trigger_materials: "新技术,新工艺,新材料,新设备,四新,鉴定,评估",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建设部令第109号",
    standard_name: "建设领域推广应用新技术管理规定",
    clause_no: "第十八条",
    clause_title: "限禁技术不得使用",
    clause_text: "任何单位和个人不得超越范围应用限制使用的技术，不得应用禁止使用的技术。",
    audit_points:
      "核对方案采用的技术是否列入《技术公告》中「限用」或「禁用」目录；限用技术是否超越允许范围；禁用技术一律不得采用。",
    profession: "new-technology",
    structure_type: null,
    trigger_materials: "新技术,新工艺,新材料,新设备,限制使用,禁止使用,落后技术,技术公告",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建设部令第109号",
    standard_name: "建设领域推广应用新技术管理规定",
    clause_no: "第二十条",
    clause_title: "违规采用责任",
    clause_text:
      "违反本规定应用限制或者禁止使用的落后技术并违反工程建设强制性标准的，依据《建设工程质量管理条例》进行处罚。",
    audit_points:
      "核对方案是否同时触发「应用落后技术」与「违反强制性标准」两个要件；一旦同时触发，须按《建设工程质量管理条例》处罚，方案不得通过审核。",
    profession: "new-technology",
    structure_type: null,
    trigger_materials: "新技术,新工艺,新材料,新设备,限制使用,禁止使用,落后技术,强制性标准",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建科〔2002〕222号",
    standard_name: "建设部推广应用新技术管理细则",
    clause_no: "第十六条",
    clause_title: "限禁技术列为审查内容",
    clause_text:
      "对技术公告公布的限用和禁用技术，施工图设计审查单位、工程监理单位和质量监督部门应将其列为审查内容；建设单位、设计单位和施工单位不得在工程中使用；凡违反技术公告应用禁用或限用落后技术的，视同使用不合格的产品，建设行政主管部门不得验收、备案；违反技术公告并违反工程建设强制性标准的，依据《建设工程质量管理条例》对实施单位进行处罚。",
    audit_points:
      "核对施工图审查、监理、质监环节是否将「限禁技术」列为审查内容；「违反技术公告」视同「使用不合格产品」不得验收备案；方案是否仍采用禁限技术。",
    profession: "new-technology",
    structure_type: null,
    trigger_materials: "新技术,新工艺,新材料,新设备,限制使用,禁止使用,技术公告",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建标〔2005〕124号",
    standard_name: "采用不符合工程建设强制性标准的新技术、新工艺、新材料核准行政许可实施细则",
    clause_no: "第三条",
    clause_title: "不符合强标须三新核准",
    clause_text:
      "在中华人民共和国境内的建设工程，拟采用不符合工程建设强制性标准的新技术、新工艺、新材料时，应当由该工程的建设单位依法申请行政许可，并按照行政许可决定的要求实施。未取得行政许可的，不得在建设工程中采用。",
    audit_points:
      "核对方案采用的「四新」是否与现行工程建设强制性标准不一致或标准未作规定；如是，必须有建设单位申请的「三新核准」行政许可决定书；未取得许可不得采用，方案不得通过。",
    profession: "new-technology",
    structure_type: null,
    trigger_materials: "新技术,新工艺,新材料,新设备,四新,强制性标准,三新核准,行政许可",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建标〔2005〕124号",
    standard_name: "采用不符合工程建设强制性标准的新技术、新工艺、新材料核准行政许可实施细则",
    clause_no: "第七条",
    clause_title: "三新核准申请条件",
    clause_text:
      "申请三新核准的事项，应当符合下列条件：（一）申请事项不符合现行相关的工程建设强制性标准；（二）申请事项直接涉及建设工程质量安全、人身健康、生命财产安全、环境保护、能源资源节约和合理利用以及其它社会公共利益；（三）申请事项已通过省级、部级或国家级的鉴定或评估，并经过专题技术论证。",
    audit_points:
      "核对三要件齐备：「不符合强标」「涉及质量安全等公共利益」「省级及以上鉴定评估+专题技术论证」；任一缺失即不符合核准条件。",
    profession: "new-technology",
    structure_type: null,
    trigger_materials: "新技术,新工艺,新材料,新设备,四新,鉴定,评估,专题技术论证,三新核准",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建标〔2005〕124号",
    standard_name: "采用不符合工程建设强制性标准的新技术、新工艺、新材料核准行政许可实施细则",
    clause_no: "第十一条",
    clause_title: "专题技术论证专家组",
    clause_text:
      "专题技术论证会应当由建设单位提出和组织，在报请国务院有关行政主管部门的标准化管理机构或省、自治区、直辖市建设行政主管部门的标准化管理机构同意后召开。专题技术论证会应有相应标准的管理机构代表、相关单位的专家或技术人员参加，专家组不得少于7人，专家组成员应具备高级技术职称并具有本专业规定的要求。专题技术论证会纪要应当包括会议概况、不符合工程建设强制性标准的情况说明、应用的可行性概要分析、结论、专家组成员签字、会议记录等。",
    audit_points:
      "论证会程序：由建设单位组织、经省级及以上标准化管理机构同意后召开；专家组不得少于7人、须高级技术职称；纪要须含专家组成员签字及明确结论。",
    profession: "new-technology",
    structure_type: null,
    trigger_materials: "新技术,新工艺,新材料,新设备,四新,专家论证,专题技术论证,三新核准",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建质函〔2017〕268号",
    standard_name: "住房城乡建设部关于做好建筑业10项新技术（2017版）推广应用的通知",
    clause_no: "通知正文",
    clause_title: "十项新技术推广义务",
    clause_text:
      "为贯彻落实《国务院办公厅关于促进建筑业持续健康发展的意见》（国办发[2017]19号），加快促进建筑产业升级，增强产业建造创新能力，我部组织编制了《建筑业10项新技术（2017版）》，现印发给你们，请做好推广应用工作，全面提升建筑业技术水平。",
    audit_points:
      "核对方案所用技术是否属于《建筑业10项新技术（2017版）》十大类（地基基础/钢筋与混凝土/模板脚手架/装配式混凝土结构/钢结构/机电安装/绿色施工/防水与围护结构节能/抗震加固监测/信息化）下的推广技术；鼓励采用并核对配套应用技术文件。",
    profession: "new-technology",
    structure_type: null,
    trigger_materials: "新技术,新工艺,新材料,新设备,十项新技术,2017版,推广应用",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═══════════════════════════════════════════════════════════════════
  // 有限空间专业（profession="limited-space"，全 structure_type=null）
  // 来源：13有限空间作业。靠 MATERIAL_KEYWORDS 识别方案。
  // ═══════════════════════════════════════════════════════════════════
  {
    standard_code: "建办质〔2025〕45号",
    standard_name: "房屋市政工程有限空间识别及施工安全作业指南（试行）",
    clause_no: "1.3.1",
    clause_title: "有限空间定义",
    clause_text:
      "有限空间指封闭或部分封闭，人员可以进入或探入，但进出或活动受限，通风不良，易造成有毒有害、易燃易爆物质积聚或氧气含量不足的空间。",
    audit_points:
      "核对方案是否先界定「有限空间」三要素：①封闭/部分封闭；②进出或活动受限；③通风不良，易积聚有毒有害/易燃易爆物质或缺氧。缺任一即不符合。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,密闭空间,受限空间,井下,污水池,化粪池,沼气池,地下室,桩孔",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建办质〔2025〕45号",
    standard_name: "房屋市政工程有限空间识别及施工安全作业指南（试行）",
    clause_no: "2.1.1",
    clause_title: "有限空间判定3+1条件",
    clause_text:
      "有限空间作业场景的判定，应同时满足3个物理条件和至少1个危险特征。3个物理条件：1封闭或部分封闭的空间，且通风不良；2空间内有人员进出的需求和可能；3进出口或空间内活动存在限制。至少存在1个危险特征：1存在或可能出现氧气含量不足；2存在或可能出现有毒有害气体；3存在或可能出现易燃易爆物质。",
    audit_points:
      "核对方案「危险有害因素辨识」章节是否按「3 物理 + 1 危险」判定：物理条件（封闭通风不良/人员进出/活动受限）须同时具备，危险特征（缺氧/有毒有害/易燃易爆）至少列一项。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,密闭空间,井下,污水池,化粪池,沼气池,桩孔,肥槽,地下室",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "总局令第69号",
    standard_name: "有限空间安全作业五条规定",
    clause_no: "一~五",
    clause_title: "有限空间五条命门",
    clause_text:
      "一、必须严格实行作业审批制度，严禁擅自进入有限空间作业。二、必须做到「先通风、再检测、后作业」，严禁通风、检测不合格作业。三、必须配备个人防中毒窒息等防护装备，设置安全警示标识，严禁无防护监护措施作业。四、必须对作业人员进行安全培训，严禁教育培训不合格上岗作业。五、必须制定应急措施，现场配备应急装备，严禁盲目施救。",
    audit_points:
      "逐条核对方案「五必须/五严禁」：①审批制度；②先通风→再检测→后作业次序；③个体防护+警示标识+监护；④培训考核合格上岗；⑤应急措施+现场装备。任一缺失或与严禁措辞冲突即不符合。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,密闭空间,气体检测仪,通风机,呼吸器,作业票",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建办质〔2025〕45号",
    standard_name: "房屋市政工程有限空间识别及施工安全作业指南（试行）",
    clause_no: "4.3.1",
    clause_title: "作业前审批制度",
    clause_text: "有限空间作业必须执行作业前审批制度，施工单位签发作业票，作业班组方可开展有限空间作业。",
    audit_points:
      "核对方案是否设「作业票/审批」章节，明确签发人、审批流程、班组持票公示。「必须」强制措辞。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,作业票,审批单",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建办质〔2025〕45号",
    standard_name: "房屋市政工程有限空间识别及施工安全作业指南（试行）",
    clause_no: "4.3.5",
    clause_title: "作业票时效≤12h",
    clause_text:
      "有限空间作业票有效时间为当班作业结束时间，且最长不得超过12h。当发生下列情形之一时，应重新办理作业票：1超出作业审批时间；2作业部位变化或作业范围扩大；3作业人员与监护人员发生变化；4作业内容或施工工艺发生变化；5作业环境条件发生较大变化。",
    audit_points:
      "作业票时效：①最长≤12h；②5种重新办票情形（超时/部位变化/人员变化/工艺变化/环境变化）是否全部列出。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,作业票",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 8958-2006",
    standard_name: "缺氧危险作业安全规程",
    clause_no: "5.1.1",
    clause_title: "先检测后作业原则",
    clause_text:
      "当从事具有缺氧危险的作业时，按照先检测后作业的原则，在作业开始前，必须准确测定作业场空气中的氧含量，并记录测定日期、测定时间、测定地点、测定方法和仪器、测定时的现场条件、测定次数、测定结果以及测定人员和记录人员。在准确测定氧含量前，严禁进入该作业场所。",
    audit_points:
      "核对方案是否写明「先检测后作业」次序及记录要素（日期/时间/地点/方法/结果/人员）。允许未测定即进入或记录要素缺失即不符合。「严禁」不可突破。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,缺氧,气体检测仪,氧气检测仪",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GBZ/T 205-2007",
    standard_name: "密闭空间作业职业危害防护规范",
    clause_no: "6.1.2",
    clause_title: "测氧测爆测毒顺序与限值",
    clause_text:
      "应用具有报警装置并经检定合格的检测设备对准入的密闭空间进行检测评价；检测顺序及项目应包括：测氧含量，正常时氧含量为18%～22%，缺氧的密闭空间应符合GB8958的规定，短时间作业时必须采取机械通风；测爆，密闭空间空气中可燃性气体浓度应低于爆炸下限的10%，对油轮船舶的拆修以及油箱、油罐的检修，空气中可燃性气体的浓度应低于爆炸下限的1%；测有毒气体，有毒气体的浓度须低于GBZ2.1所规定的浓度要求。",
    audit_points:
      "①顺序为测氧→测爆→测毒；②氧含量18%~22%；③可燃气<LEL的10%（油舱/油罐<1%）；④有毒气体低于GBZ2.1限值。顺序错乱或限值遗漏即不符合。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,密闭空间,气体检测仪,测爆仪,可燃气体",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "CJJ 6-2009",
    standard_name: "城镇排水管道维护安全技术规程",
    clause_no: "5.3.2",
    clause_title: "井下氧含量≥19.5%及H2S/CO限值",
    clause_text:
      "井下的空气含氧量不得低于19.5%。井下有毒有害气体的浓度除应符合国家现行有关标准的规定外，常见有毒有害、易燃易爆气体的浓度和爆炸范围还应符合表5.3.3的规定：硫化氢最高容许浓度10mg/m³，爆炸范围4.3~45.5%；一氧化碳（非高原）时间加权平均容许浓度20mg/m³、短时间接触容许浓度30mg/m³，爆炸范围12.5~74.2%；甲烷爆炸范围5.0~15.0%。",
    audit_points:
      "①氧含量≥19.5%；②硫化氢MAC=10mg/m³；③一氧化碳PC-TWA=20、PC-STEL=30mg/m³。限值低于上述或缺失硫化氢/一氧化碳阈值即不符合。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "井下作业,排水管道,检查井,污水池,硫化氢,一氧化碳,甲烷,气体检测仪",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "建办质〔2025〕45号",
    standard_name: "房屋市政工程有限空间识别及施工安全作业指南（试行）",
    clause_no: "4.6.8",
    clause_title: "过程检测每30min记录",
    clause_text:
      "有限空间作业过程中应全程进行气体检测：1作业人员应携带扩散式气体检测报警仪，并全程开启；2有限空间场所设有固定气体检测装备的，应全程开启；3监护人员应每隔30min如实记录一次过程检测结果。记录内容应包括检测位置、检测时间、检测气体种类和浓度等信息。",
    audit_points:
      "①作业人员随身携带扩散式仪并全程开启；②监护人员每30min记录一次（位置/时间/气体种类/浓度）。无固定/便携检测配置或记录频次>30min即不符合。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,气体检测仪,扩散式报警仪,固定式检测仪",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 8958-2006",
    standard_name: "缺氧危险作业安全规程",
    clause_no: "5.3.2",
    clause_title: "严禁纯氧通风换气",
    clause_text:
      "在已确定为缺氧作业环境的作业场所，必须采取充分的通风换气措施，使该环境空气中氧含量在作业过程中始终保持在0.195以上。严禁用纯氧进行通风换气。",
    audit_points:
      "①作业全程氧含量>19.5%（0.195）；②通风介质为新鲜空气，严禁纯氧通风。出现纯氧/富氧通风/氧气直送或未保证全程氧含量即不符合。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,通风机,送风机,氧气",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 8958-2006",
    standard_name: "缺氧危险作业安全规程",
    clause_no: "5.3.3",
    clause_title: "严禁过滤式面具",
    clause_text:
      "作业人员必须配备并使用空气呼吸器或软管面具等隔离式呼吸保护器具。严禁使用过滤式面具。",
    audit_points:
      "①配备隔离式呼吸器（空气呼吸器/软管面具/长管呼吸器）；②明确严禁过滤式面具。出现防毒面具/过滤式作为主防护即不符合。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,呼吸器,空气呼吸器,长管面具,防毒面具",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "CJJ 6-2009",
    standard_name: "城镇排水管道维护安全技术规程",
    clause_no: "5.1.10",
    clause_title: "井下连续检测+监护≥2人",
    clause_text:
      "井下作业时，必须进行连续气体检测，且井上监护人员不得少于两人；进入管道内作业时，井室内应设置专人呼应和监护，监护人员严禁擅离职守。",
    audit_points:
      "①气体检测为「连续」而非定时；②井上监护≥2人；③进入管道时井室内增设专人呼应。「严禁擅离职守」不可突破。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "井下作业,排水管道,检查井,气体检测仪,监护人员",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "CJJ 6-2009",
    standard_name: "城镇排水管道维护安全技术规程",
    clause_no: "7.0.4",
    clause_title: "井下抢救严禁盲目施救",
    clause_text:
      "当需下井抢救时，抢救人员必须在做好个人安全防护并有专人监护下进行下井抢救，必须佩戴好便携式空气呼吸器、悬挂双背带式安全带，并系好安全绳，严禁盲目施救。",
    audit_points:
      "①下井抢救前先个人防护+专人监护；②佩戴便携式空气呼吸器+悬挂双背带式安全带+安全绳；③明确严禁盲目施救。允许未防护下井救人即不符合。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,井下作业,空气呼吸器,安全带,安全绳,救援三脚架",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "应急厅函〔2020〕299号",
    standard_name: "有限空间作业安全指导手册",
    clause_no: "六·2",
    clause_title: "应急预案演练频次",
    clause_text:
      "单位应根据有限空间作业的特点，辨识可能的安全风险，明确救援工作分工及职责、现场处置程序等，按照《生产安全事故应急预案管理办法》（应急管理部令第2号）和《生产经营单位生产安全事故应急预案编制导则》（GB/T29639—2020），制定科学、合理、可行、有效的有限空间作业安全事故专项应急预案或现场处置方案，定期组织培训，确保有限空间作业现场负责人、监护人员、作业人员以及应急救援人员掌握应急预案内容。有限空间作业安全事故专项应急预案应每年至少组织1次演练，现场处置方案应至少每半年组织1次演练。",
    audit_points:
      "①制定专项应急预案或现场处置方案；②专项预案每年≥1次演练；③现场处置方案每半年≥1次演练。",
    profession: "limited-space",
    structure_type: null,
    trigger_materials: "有限空间,应急预案,救援装备",
    trigger_processes: null,
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═══════════════════════════════════════════════════════════════════
  // 幕墙专业（profession="curtain-wall"）
  // 来源：7建筑幕墙安装工程。构造轴=幕墙形式（构件式/单元式/点支承）+通用
  // ═══════════════════════════════════════════════════════════════════
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "6.3.1",
    clause_title: "立柱截面最小厚度",
    clause_text:
      "立柱截面主要受力部位的厚度，应符合下列要求：1铝型材截面开口部位的厚度不应小于3.0mm，闭口部位的厚度不应小于2.5mm；型材孔壁与螺钉之间直接采用螺纹受力连接时，其局部厚度尚不应小于螺钉的公称直径；2钢型材截面主要受力部位的厚度不应小于3.0mm。3对偏心受压立柱，其截面宽厚比应符合本规范第6.2.1条的相应规定。",
    audit_points:
      "铝型材立柱截面厚度三限值：①开口部位≥3.0mm；②闭口部位≥2.5mm；③螺纹受力连接处局部厚度≥螺钉公称直径。钢型材≥3.0mm。未标注开口/闭口区分或数值低于任一即不符合。",
    profession: "curtain-wall",
    structure_type: "构件式幕墙",
    trigger_materials: "立柱,铝型材,钢型材,铝合金型材,螺钉",
    trigger_processes: "安装,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "6.2.1",
    clause_title: "横梁截面最小厚度",
    clause_text:
      "横梁截面主要受力部位的厚度，应符合下列要求：1截面自由挑出部位和双侧加劲部位的宽厚比b₀/t，应符合表6.2.1的要求；2当横梁跨度不大于1.2m时，铝合金型材截面主要受力部位的厚度不应小于2.0mm；当横梁跨度大于1.2m时，其截面主要受力部位的厚度不应小于2.5mm。型材孔壁与螺钉之间直接采用螺纹受力连接时，其局部截面厚度不应小于螺钉的公称直径；3钢型材截面主要受力部位的厚度不应小于2.5mm。",
    audit_points:
      "横梁厚度按跨度分档：①跨度≤1.2m铝型材≥2.0mm；②跨度>1.2m铝型材≥2.5mm；③螺纹连接处≥螺钉公称直径；④钢型材≥2.5mm。横梁只按跨度分档不分开闭口，与立柱(6.3.1)不同。",
    profession: "curtain-wall",
    structure_type: "构件式幕墙",
    trigger_materials: "横梁,铝型材,钢型材,螺钉",
    trigger_processes: "安装,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "6.3.3",
    clause_title: "立柱拼缝与芯柱连接",
    clause_text:
      "上、下立柱之间应留有不小于15mm的缝隙，闭口型材可采用长度不小于250mm的芯柱连接，芯柱与立柱应紧密配合。芯柱与上柱后下柱之间应采用机械连接方法加以固定。开口型材上柱与下柱之间可采用等强型材机械连接。",
    audit_points:
      "①上下立柱缝隙≥15mm；②闭口型材芯柱长度≥250mm；③芯柱与上下柱机械连接固定。注意玻璃幕墙芯柱250mm，与JGJ 133金属与石材幕墙5.7.2的400mm不同，勿混用。",
    profession: "curtain-wall",
    structure_type: "构件式幕墙",
    trigger_materials: "立柱,芯柱,铝型材",
    trigger_processes: "安装,拼装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 133-2001",
    standard_name: "金属与石材幕墙工程技术规范",
    clause_no: "5.5.7",
    clause_title: "短槽石板挂钩最小厚度",
    clause_text:
      "短槽支承的石板，其抗剪设计应符合下列规定：1短槽支承石板的不锈钢挂钩的厚度不应小于3.0mm，铝合金挂钩的厚度不应小于4.0mm，其承受的剪应力可按式5.5.5-1、式5.5.5-2计算，并应符合式5.5.5-3的条件。",
    audit_points:
      "短槽石材幕墙挂钩厚度：①不锈钢挂钩≥3.0mm；②铝合金挂钩≥4.0mm。与人造板材挂件厚度(瓷板/微晶玻璃)按面板材质区分，勿混用。",
    profession: "curtain-wall",
    structure_type: "构件式幕墙",
    trigger_materials: "挂钩,不锈钢挂钩,铝合金挂钩,石材,花岗石,石板",
    trigger_processes: "安装,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 133-2001",
    standard_name: "金属与石材幕墙工程技术规范",
    clause_no: "6.4.7",
    clause_title: "单元金属幕墙吊挂件",
    clause_text:
      "金属幕墙的吊挂件、安装件应符合下列规定：1单元金属幕墙使用的吊挂件、支撑件，宜采用铝合金件或不锈钢件，并应具备可调整范围；2单元幕墙的吊挂件与预埋件的连接应采用穿透螺栓；3铝合金立柱的连接部位的局部壁厚不得小于5mm。",
    audit_points:
      "①吊挂件/支撑件宜铝合金或不锈钢、具备可调整范围；②吊挂件与预埋件必须用穿透螺栓；③铝合金立柱连接部位局部壁厚≥5mm（是连接部位局部加厚，非全立柱壁厚）。",
    profession: "curtain-wall",
    structure_type: "单元式幕墙",
    trigger_materials: "吊挂件,安装件,支撑件,预埋件,铝合金立柱,穿透螺栓",
    trigger_processes: "安装,吊装,拼装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 133-2001",
    standard_name: "金属与石材幕墙工程技术规范",
    clause_no: "6.3.6",
    clause_title: "单元石板幕墙挂件厚度",
    clause_text:
      "单元石板幕墙的加工组装应符合下列规定：1有防火要求的全石板幕墙单元，应将石板、防火板、防火材料按设计要求组装在铝合金框架上；2有可视部分的混合幕墙单元，应将玻璃板、石板、防火板及防火材料按设计要求组装在铝合金框架上；3幕墙单元内石板之间可采用铝合金T形连接件连接；T形连接件的厚度应根据石板的尺寸及重量经计算后确定，且其最小厚度不应小于4.0mm；4幕墙单元内，边部石板与金属框架的连接，可采用铝合金L形连接件，其厚度应根据石板尺寸及重量经计算后确定，且其最小厚度不应小于4.0mm。",
    audit_points:
      "①T形连接件（单元内石板之间）≥4.0mm；②L形连接件（边部石板与框架）≥4.0mm；③厚度应按石板尺寸及重量经计算确定，4.0mm为最小下限。",
    profession: "curtain-wall",
    structure_type: "单元式幕墙",
    trigger_materials: "T形连接件,L形连接件,挂件,铝合金框架,石板,石材",
    trigger_processes: "拼装,安装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "9.7.7",
    clause_title: "单元组件框自攻螺钉",
    clause_text:
      "当采用自攻螺钉连接单元组件框时，每处螺钉不应少于3个，螺钉直径不应小于4mm。螺钉孔最大内径、最小内径和拧入扭矩应符合表9.7.7的要求。",
    audit_points:
      "①每处螺钉数量≥3个；②螺钉直径≥4mm；③螺钉孔径与拧入扭矩应符合表9.7.7。少于3个即不符合。",
    profession: "curtain-wall",
    structure_type: "单元式幕墙",
    trigger_materials: "自攻螺钉,螺钉,单元组件框",
    trigger_processes: "拼装,安装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "4.4.2",
    clause_title: "点支承玻璃必钢化",
    clause_text:
      "点支承玻璃幕墙的面板玻璃应采用钢化玻璃。采用玻璃肋支承的点支承玻璃幕墙，其玻璃肋应采用钢化夹层玻璃。",
    audit_points:
      "①面板玻璃必须采用钢化玻璃；②点支承的玻璃肋必须采用钢化夹层玻璃（既钢化又夹层）。任一降级（半钢化、普通夹层）即不符合。",
    profession: "curtain-wall",
    structure_type: "点支承幕墙",
    trigger_materials: "钢化玻璃,钢化夹层玻璃,玻璃面板,玻璃肋,点支承玻璃",
    trigger_processes: "安装,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "8.1.1",
    clause_title: "点支承孔边距与点数",
    clause_text:
      "四边形玻璃面板可采用四点支承，有依据时也可采用六点支承；三角形玻璃面板可采用三点支承。玻璃面板支承孔边与板边的距离不宜小于70mm。",
    audit_points:
      "①四边形常用四点支承（六点需有依据）；②支承孔边与板边距离≥70mm；③配合8.1.2：浮头式连接件玻璃≥6mm、沉头式≥8mm。",
    profession: "curtain-wall",
    structure_type: "点支承幕墙",
    trigger_materials: "点支承装置,浮头式连接件,沉头式连接件,钢化玻璃",
    trigger_processes: "安装,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "8.1.2",
    clause_title: "点支承玻璃最小厚度",
    clause_text:
      "采用浮头式连接件的幕墙玻璃厚度不应小于6mm；采用沉头式连接件的幕墙玻璃厚度不应小于8mm。安装连接件的夹层玻璃和中空玻璃，其单片厚度也应符合上述要求。",
    audit_points:
      "按连接件类型分档：①浮头式连接件玻璃≥6mm；②沉头式连接件玻璃≥8mm（沉头需沉孔局部削弱）；③夹层/中空玻璃单片厚度也须符合（不是总厚度）。",
    profession: "curtain-wall",
    structure_type: "点支承幕墙",
    trigger_materials: "浮头式连接件,沉头式连接件,点支承装置,钢化玻璃,夹层玻璃,中空玻璃",
    trigger_processes: "安装,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "5.6.1",
    clause_title: "硅酮结构胶宽度厚度",
    clause_text:
      "硅酮结构密封胶的粘接宽度应符合本规范第5.6.3或5.6.4条的规定，且不应小于7mm；其粘接厚度应符合本规范第5.6.5条的规定，且不应小于6mm。硅酮结构密封胶的粘接宽度宜大于厚度，但不宜大于厚度的2倍。隐框玻璃幕墙的硅酮结构密封胶的粘接厚度不应大于12mm。",
    audit_points:
      "隐框/半隐框玻璃幕墙硅酮结构胶三限值：①粘接宽度≥7mm；②粘接厚度≥6mm；③隐框幕墙粘接厚度≤12mm（上限）。宽度宜大于厚度但不宜大于厚度2倍。",
    profession: "curtain-wall",
    structure_type: null,
    trigger_materials: "硅酮结构密封胶,硅酮结构胶,隐框幕墙,半隐框幕墙,结构胶",
    trigger_processes: "安装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "3.6.2",
    clause_title: "结构胶相容性试验",
    clause_text:
      "硅酮结构密封胶使用前，应经国家认可的检测机构进行与其相接触材料的相容性和剥离粘结性试验，并应对邵氏硬度、标准状态拉伸粘结性能进行复验。检验不合格的产品不得使用。进口硅酮结构密封胶应具有商检报告。",
    audit_points:
      "硅酮结构胶使用前四项试验：①相容性试验；②剥离粘结性试验；③邵氏硬度复验；④标准状态拉伸粘结性能复验。不合格不得使用，进口胶须商检报告。",
    profession: "curtain-wall",
    structure_type: null,
    trigger_materials: "硅酮结构密封胶,硅酮结构胶,中性硅酮结构胶",
    trigger_processes: "安装,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "5.5.7",
    clause_title: "后加锚栓连接七规定",
    clause_text:
      "玻璃幕墙构架与主体结构采用后加锚栓连接时，应符合下列规定：1产品应有出厂合格证；2碳素钢锚栓应经过防腐处理；3应进行承载力现场试验，必要时应进行极限拉拔试验；4每个连接节点不应少于2个锚栓；5锚栓直径应通过承载力计算确定，并不应小于10mm；6不宜在与化学锚栓接触的连接件上进行焊接操作；7锚栓承载力设计值不应大于其极限承载力的50%。",
    audit_points:
      "后加锚栓（后置埋件）七项：①出厂合格证；②碳素钢锚栓防腐；③承载力现场试验/极限拉拔；④每节点≥2个；⑤直径≥10mm；⑥不宜在化学锚栓接触件焊接；⑦承载力设计值≤极限50%（安全系数≥2）。优先用预埋件，无预埋件方用后加锚栓。",
    profession: "curtain-wall",
    structure_type: null,
    trigger_materials: "后加锚栓,锚栓,化学锚栓,后置埋件,连接节点,碳素钢锚栓",
    trigger_processes: "安装,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 102-2003",
    standard_name: "玻璃幕墙工程技术规范",
    clause_no: "4.4.11",
    clause_title: "层间岩棉封堵",
    clause_text:
      "玻璃幕墙与各层楼板、隔墙外沿间的缝隙，当采用岩棉或矿棉封堵时，其厚度不应小于100mm，并应填充密实；楼层间水平防烟带的岩棉或矿棉宜采用厚度不小于1.5mm的镀锌钢板承托；承托板与主体结构、幕墙结构及承托板之间的缝隙宜填充防火密封材料。当建筑要求防火分区间设置通透隔断时，可采用防火玻璃，其耐火极限应符合设计要求。",
    audit_points:
      "楼层间封堵三项：①岩棉/矿棉厚度≥100mm且填充密实；②镀锌钢板承托厚度≥1.5mm；③承托板与主体/幕墙缝隙填充防火密封材料。",
    profession: "curtain-wall",
    structure_type: null,
    trigger_materials: "岩棉,矿棉,镀锌钢板,承托板,防火密封材料,防火玻璃",
    trigger_processes: "安装,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 133-2001",
    standard_name: "金属与石材幕墙工程技术规范",
    clause_no: "3.2.2",
    clause_title: "花岗石弯曲强度≥8MPa",
    clause_text: "花岗石板材的弯曲强度应经法定检测机构检测确定，其弯曲强度不应小于8.0MPa。",
    audit_points:
      "花岗石板材弯曲强度≥8.0MPa（JGJ 133-2001强制性条文）；须由法定检测机构出具报告，不得用厂家自检替代；任一试件低于8MPa该批不得用于幕墙（非平均值合格即可）。",
    profession: "curtain-wall",
    structure_type: null,
    trigger_materials: "花岗石,石材,石板,花岗石板材",
    trigger_processes: "检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 336-2016",
    standard_name: "人造板材幕墙工程技术规范",
    clause_no: "5.2.5",
    clause_title: "人造板材强度设计值",
    clause_text:
      "瓷板、陶板、微晶玻璃、木纤维板和纤维水泥板面板的强度设计值，可按表5.2.5的规定采用。表5.2.5面板材料强度设计值（N/mm²）：瓷板抗弯强度设计值f=15.0、抗剪强度设计值f₀=7.5；陶板按类别分为AⅠ类（f=16.0，f₀=2.0）、AⅡa类（f=6.2，f₀=1.2）、AⅡb类（f=4.5，f₀=0.9）；微晶玻璃（f=16.0，f₀=3.2）；木纤维板（f=56.0，f₀=—）；纤维水泥板（f=11.5，f₀=2.3）。",
    audit_points:
      "按材质查表5.2.5：①瓷板f=15.0；②陶板AⅠ/AⅡa/AⅡb类分别16.0/6.2/4.5（须先定陶板类别）；③微晶玻璃f=16.0；④木纤维板f=56.0；⑤纤维水泥板f=11.5。弯曲应力设计值不得超过对应f值。",
    profession: "curtain-wall",
    structure_type: null,
    trigger_materials: "瓷板,陶板,微晶玻璃,木纤维板,纤维水泥板,人造板材,石材蜂窝板",
    trigger_processes: "设计计算,验算,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 21086-2007",
    standard_name: "建筑幕墙",
    clause_no: "5.1.1.1",
    clause_title: "抗风压性能指标≥1.0kPa",
    clause_text:
      "幕墙的抗风压性能指标应根据幕墙所受的风荷载标准值Wk确定，其指标值不应低于Wk，且不应小于1.0kPa。Wk的计算应符合GB50009的规定。",
    audit_points:
      "抗风压性能双控：①性能指标值≥风荷载标准值Wk；②绝对下限≥1.0kPa。抗风压性能检验不合格则该幕墙判定为不合格（一票否决）。",
    profession: "curtain-wall",
    structure_type: null,
    trigger_materials: "幕墙,抗风压性能",
    trigger_processes: "设计计算,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═══════════════════════════════════════════════════════════════════
  // 钢结构专业（profession="steel-structure"）
  // 来源：9钢结构安装工程。构造轴=焊接/高强螺栓/吊装/网架 +通用
  // ═══════════════════════════════════════════════════════════════════
  {
    standard_code: "GB 50661-2011",
    standard_name: "钢结构焊接规范",
    clause_no: "8.2.5",
    clause_title: "焊缝等级及无损探伤",
    clause_text:
      "设计要求全焊透的焊缝，其内部缺欠的检测应符合下列要求：1一级焊缝应进行100%的检测，其合格等级应符合本规范8.2.6条中B级检验的II级或II级以上要求；2二级焊缝应进行抽检，抽检比例应不小于20%，其合格等级应符合本规范8.2.6条中B级检测的III级或III级以上要求；3三级焊缝应根据设计要求进行相关的无损检测。",
    audit_points:
      "一级焊缝100%探伤合格II级及以上；二级焊缝抽检≥20%合格III级及以上；III、IV类钢材焊后24h检测，屈服强度>690MPa钢材48h后检测。严禁漏检或比例不足。",
    profession: "steel-structure",
    structure_type: "焊接连接",
    trigger_materials: "对接焊缝,一级焊缝,二级焊缝,全焊透焊缝",
    trigger_processes: "焊接,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50661-2011",
    standard_name: "钢结构焊接规范",
    clause_no: "6.1.1",
    clause_title: "焊接工艺评定",
    clause_text:
      "除非符合本章6.6节规定的免予评定条件，施工单位首次采用的钢材、焊接材料、焊接方法、接头形式、焊接位置、焊后热处理制度以及焊接工艺参数、预热和后热措施等各种参数的组合条件，应在钢结构构件制作及安装施工之前进行焊接工艺评定。",
    audit_points:
      "「首次采用」的钢材/焊材/方法/接头/位置/热处理等组合必须施工前完成焊接工艺评定；评定试件应由本企业持证焊工施焊；严禁未评定先施工。",
    profession: "steel-structure",
    structure_type: "焊接连接",
    trigger_materials: "钢材,焊条,焊丝,焊剂,焊接接头",
    trigger_processes: "焊接,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50661-2011",
    standard_name: "钢结构焊接规范",
    clause_no: "7.4.1",
    clause_title: "焊工资质(定位焊)",
    clause_text: "定位焊必须由持相应合格证的焊工施焊，所用焊接材料应与正式焊缝的焊接材料相当。",
    audit_points:
      "定位焊必须由持相应合格证焊工施焊；焊工合格证有效期3年、中断超半年需重考；严禁无证施焊或超越合格项目范围施焊。",
    profession: "steel-structure",
    structure_type: "焊接连接",
    trigger_materials: "焊接材料,定位焊缝,焊工",
    trigger_processes: "焊接",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50661-2011",
    standard_name: "钢结构焊接规范",
    clause_no: "7.2.3",
    clause_title: "低氢焊条烘干保管",
    clause_text:
      "低氢型焊条的烘干应符合下列要求：1焊条使用前在300～430℃温度下烘干1.0～2h；烘干时间以烘箱到达最终烘干温度后开始计算；2烘干后的低氢焊条应放置于温度不低于120℃的保温箱中存放、待用，使用时应置于保温筒中，随用随取；3焊条烘干后放置时间不应超过4h，用于III、IV类结构钢的焊条，烘干后放置时间不应超过2h；重新烘干次数不应超过2次。",
    audit_points:
      "低氢焊条300~430℃烘干1~2h；保温箱存放≥120℃；放置时间≤4h（III、IV类钢≤2h）；重新烘干≤2次。",
    profession: "steel-structure",
    structure_type: "焊接连接",
    trigger_materials: "低氢型焊条,碱性焊条,焊剂",
    trigger_processes: "焊接",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GB 50661-2011",
    standard_name: "钢结构焊接规范",
    clause_no: "7.5.2",
    clause_title: "焊接环境严禁条件",
    clause_text:
      "当焊接作业处于下列情况下应严禁焊接：1焊接作业区的相对湿度大于90%；2焊件表面潮湿或暴露于雨、冰、雪中；3焊接作业条件不符合焊接安全作业技术规程规定要求时。",
    audit_points:
      "严禁在相对湿度>90%、焊件表面潮湿或雨/冰/雪中、不符合安全规程时焊接；风速限制：焊条电弧焊≤8m/s，气体保护焊≤2m/s；母材<0℃时需预热确保焊接区≥20℃。",
    profession: "steel-structure",
    structure_type: "焊接连接",
    trigger_materials: "钢材,焊缝",
    trigger_processes: "焊接",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50661-2011",
    standard_name: "钢结构焊接规范",
    clause_no: "8.2.3",
    clause_title: "焊缝外观缺陷限值",
    clause_text:
      "所有焊缝应冷却到环境温度后方可进行外观检测，焊缝外观质量应满足表8.2.3的规定。其中：裂纹不允许；咬边一级不允许、二级≤0.05t且≤0.5mm连续长度≤100mm且总长≤10%焊缝全长、三级≤0.1t且≤1mm长度不限；未焊满一级不允许、二级≤0.2+0.02t且≤1mm每100mm累积≤25mm；表面气孔一、二级不允许。",
    audit_points:
      "裂纹所有等级不允许；咬边一级不允许、二级≤0.5mm且总长≤10%全长；未焊满一级不允许、二级≤1mm/100mm内累积≤25mm；表面气孔一、二级不允许；外观应在冷却到环境温度后检测。",
    profession: "steel-structure",
    structure_type: "焊接连接",
    trigger_materials: "焊缝,一级焊缝,二级焊缝,三级焊缝",
    trigger_processes: "焊接,检查,验收",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ 82-2011",
    standard_name: "钢结构高强度螺栓连接技术规程",
    clause_no: "6.3.1",
    clause_title: "扭矩系数检验",
    clause_text:
      "高强度大六角头螺栓连接副应进行扭矩系数、螺栓楔负载、螺母保证载荷检验，其检验方法和结果应符合现行国家标准《钢结构用高强度大六角头螺栓、大六角螺母、垫圈技术条件》GB/T1231规定。高强度大六角头螺栓连接副扭矩系数的平均值及标准偏差应符合表6.3.1的要求。",
    audit_points:
      "扭矩系数平均值0.110~0.150、标准偏差≤0.0100；每套连接副只做一次试验不得重复使用；垫圈转动时试验无效；保管期超6个月须重新试验。",
    profession: "steel-structure",
    structure_type: "高强螺栓连接",
    trigger_materials: "高强度大六角头螺栓,连接副,螺栓,螺母,垫圈",
    trigger_processes: "检查,验收,安装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 82-2011",
    standard_name: "钢结构高强度螺栓连接技术规程",
    clause_no: "3.2.4",
    clause_title: "摩擦面抗滑移系数",
    clause_text:
      "高强度螺栓连接摩擦面抗滑移系数μ的取值应符合表3.2.4-1和表3.2.4-2中的规定。采用其他方法处理时，其处理工艺及抗滑移系数值均应经试验确定。",
    audit_points:
      "喷砂（丸）Q235 μ=0.45、Q345/Q390/Q420 μ=0.50；钢丝刷清除浮锈Q235 0.30、Q390 0.35；无机富锌漆(60-80μm) 0.40；其他处理方法均应经试验确定。",
    profession: "steel-structure",
    structure_type: "高强螺栓连接",
    trigger_materials: "摩擦面,高强度螺栓,连接钢板,抗滑移试件",
    trigger_processes: "检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 82-2011",
    standard_name: "钢结构高强度螺栓连接技术规程",
    clause_no: "6.4.14",
    clause_title: "初拧复拧终拧",
    clause_text:
      "高强度大六角头螺栓连接副的拧紧应分为初拧、终拧。对于大型节点应分为初拧、复拧、终拧。初拧扭矩和复拧扭矩为终拧扭矩的50%左右。初拧或复拧后的高强度螺栓应用颜色在螺母上标记，按本规程第6.4.13条规定的终拧扭矩值进行终拧。终拧后的高强度螺栓应用另一种颜色在螺母上标记。高强度大六角头螺栓连接副的初拧、复拧、终拧宜在一天内完成。",
    audit_points:
      "拧紧分初拧、终拧，大型节点初拧、复拧、终拧；初拧/复拧扭矩为终拧50%左右；初拧、终拧用不同颜色标记；宜在一天内完成；施拧顺序由中央向外、刚度大部位向约束小方向。",
    profession: "steel-structure",
    structure_type: "高强螺栓连接",
    trigger_materials: "高强度大六角头螺栓,扭剪型高强螺栓,连接副",
    trigger_processes: "安装,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 82-2011",
    standard_name: "钢结构高强度螺栓连接技术规程",
    clause_no: "6.2.4",
    clause_title: "螺栓孔穿孔率",
    clause_text:
      "采用标准圆孔连接处板迭上所有螺栓孔，均应采用量规检查，其通过率应符合下列规定：1用比孔的公称直径小1.0mm的量规检查，每组至少应通过85%；2用比螺栓公称直径大(0.2~0.3)mm的量规检查(M22及以下规格为大0.2mm，M24~M30规格为大0.3mm)，应全部通过。",
    audit_points:
      "小1.0mm量规每组至少通过85%；比螺栓直径大0.2-0.3mm量规应全部通过；补焊重钻数量≤该组20%。",
    profession: "steel-structure",
    structure_type: "高强螺栓连接",
    trigger_materials: "螺栓孔,高强度螺栓,连接板",
    trigger_processes: "检查,安装,验收",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ 82-2011",
    standard_name: "钢结构高强度螺栓连接技术规程",
    clause_no: "3.1.7",
    clause_title: "连接混用禁止",
    clause_text:
      "在同一连接接头中，高强度螺栓连接不应与普通螺栓连接混用。承压型高强度螺栓连接不应与焊接连接并用。",
    audit_points:
      "同一接头中高强螺栓不应与普通螺栓混用；承压型高强螺栓不应与焊接连接并用；不得用高强螺栓兼作临时螺栓；安装时严禁强行穿入、修孔数量≤节点25%、严禁气割扩孔。",
    profession: "steel-structure",
    structure_type: "高强螺栓连接",
    trigger_materials: "高强度螺栓,普通螺栓,焊接接头",
    trigger_processes: "安装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50755-2012",
    standard_name: "钢结构工程施工规范",
    clause_no: "11.2.4",
    clause_title: "吊装额定起重量",
    clause_text:
      "钢结构吊装作业必须在起重设备的额定起重量范围内进行。用于吊装的钢丝绳、吊装带、卸扣、吊钩等吊具应经检验合格，并应在其额定许用荷载范围内使用。",
    audit_points:
      "必须在起重设备额定起重量范围内吊装；吊具必须检验合格并在额定许用荷载内使用；GB 55006-2021第7.1.5条同步规定此条为全文强制性条文；严禁超载或使用未检验吊具。",
    profession: "steel-structure",
    structure_type: "钢构件吊装",
    trigger_materials: "起重设备,钢丝绳,吊装带,卸扣,吊钩",
    trigger_processes: "吊装,验算,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50755-2012",
    standard_name: "钢结构工程施工规范",
    clause_no: "11.2.5",
    clause_title: "双机抬吊负荷限值",
    clause_text:
      "构件重量不得超过两台起重设备额定起重量总和的75%，单台起重设备的负荷量不得超过额定起重量的80%。",
    audit_points:
      "双机抬吊：构件重量≤两机总额定起重量75%；单机负荷≤额定起重量80%；两个限值同时生效；须列明双机协调与同步控制措施。",
    profession: "steel-structure",
    structure_type: "钢构件吊装",
    trigger_materials: "起重设备,钢构件",
    trigger_processes: "吊装,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50755-2012",
    standard_name: "钢结构工程施工规范",
    clause_no: "11.4.2",
    clause_title: "钢梁吊点及长度限值",
    clause_text:
      "钢梁宜采用两点起吊；当单根钢梁长度大于21m，采用两点吊装不能满足构件强度和变形要求时，宜设置3个~4个吊装点吊装或采用平衡梁吊装，吊点位置应通过计算确定。",
    audit_points:
      "钢梁>21m时两点不能满足要求应3-4个吊点或平衡梁；吊点位置应通过计算确定；动力系数宜取1.1~1.4并验算吊装状态强度、稳定性、变形。",
    profession: "steel-structure",
    structure_type: "钢构件吊装",
    trigger_materials: "钢梁,钢构件,平衡梁",
    trigger_processes: "吊装,验算",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GB 50755-2012",
    standard_name: "钢结构工程施工规范",
    clause_no: "4.2.6",
    clause_title: "临时支撑拆除",
    clause_text:
      "临时支承结构的拆除顺序和步骤应通过分析和计算确定，并应编制专项施工方案，必要时应经专家论证。",
    audit_points:
      "拆撑顺序应通过分析和计算确定；应编制专项施工方案；必要时应经专家论证；单层钢结构应及时形成空间结构稳定体系后扩展安装。",
    profession: "steel-structure",
    structure_type: "钢构件吊装",
    trigger_materials: "临时支撑,缆绳,稳定体系",
    trigger_processes: "拆除,验算,安装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50755-2012",
    standard_name: "钢结构工程施工规范",
    clause_no: "11.7.1",
    clause_title: "大跨度空间钢结构安装方法",
    clause_text:
      "大跨度空间钢结构可根据结构特点和现场施工条件，采用高空散装法、分条分块吊装法、滑移法、单元或整体提升（顶升）法、整体吊装法、折叠展开式整体提升法、高空悬拼安装法等安装方法。",
    audit_points:
      "方案须从高空散装/分条分块/滑移/整体提升（顶升）/整体吊装/折叠展开/高空悬拼中明确选择并附验算；高耸钢结构整体起扳时吊点数量位置应通过计算确定并对不同倾斜角度进行安全验算。",
    profession: "steel-structure",
    structure_type: "网架安装",
    trigger_materials: "大跨度空间钢结构,网架,钢网壳",
    trigger_processes: "安装,吊装,拼装,验算",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GB 50755-2012",
    standard_name: "钢结构工程施工规范",
    clause_no: "7.4.14",
    clause_title: "螺栓球节点拧入长度",
    clause_text:
      "螺栓球节点网架总拼完成后，高强度螺栓与球节点应紧固连接，螺栓拧入螺栓球内的螺纹长度不应小于螺栓直径的1.1倍，连接处不应出现有间隙、松动等未拧紧情况。",
    audit_points:
      "螺栓拧入螺纹长度≥螺栓直径1.1倍；连接处不应出现间隙、松动等未拧紧情况；网架总拼完成后应进行挠度测量；高强度螺栓严禁强行穿入。",
    profession: "steel-structure",
    structure_type: "网架安装",
    trigger_materials: "螺栓球节点,高强度螺栓,网架构件",
    trigger_processes: "拼装,安装,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 51249-2017",
    standard_name: "建筑钢结构防火技术规范",
    clause_no: "4.1.3",
    clause_title: "防火涂料厚度及选用",
    clause_text:
      "钢结构采用喷涂防火涂料保护时，应符合下列规定：1室内隐蔽构件，宜选用非膨胀型防火涂料；2设计耐火极限大于1.50h的构件，不宜选用膨胀型防火涂料；3室外、半室外钢结构采用膨胀型防火涂料时，应选用符合环境对其性能要求的产品；4非膨胀型防火涂料涂层的厚度不应小于10mm；5防火涂料与防腐涂料应相容、匹配。",
    audit_points:
      "非膨胀型涂层厚度≥10mm；耐火极限>1.50h构件不宜用膨胀型；防火与防腐涂料应相容匹配；非膨胀型80%以上面积符合设计且最薄处≥设计85%。",
    profession: "steel-structure",
    structure_type: null,
    trigger_materials: "防火涂料,膨胀型防火涂料,非膨胀型防火涂料,防腐涂料",
    trigger_processes: "验收,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 55006-2021",
    standard_name: "钢结构通用规范",
    clause_no: "7.3.1",
    clause_title: "防腐涂层厚度",
    clause_text:
      "钢结构防腐涂料、涂装遍数、涂层厚度均应符合设计和涂料产品说明书要求。当设计对涂层厚度无要求时，涂层干漆膜总厚度：室外应为150μm，室内应为125μm，其允许偏差为-25μm。检查数量与检验方法应符合下列规定：1按构件数抽查10%，且同类构件不应少于3件；2每个构件检测5处，每处数值为3个相距50mm测点涂层干漆膜厚度的平均值。",
    audit_points:
      "无设计要求时室外150μm、室内125μm，允许偏差-25μm；按构件数抽查10%且≥3件；每构件5处每处为3个相距50mm测点平均值。",
    profession: "steel-structure",
    structure_type: null,
    trigger_materials: "防腐涂料,干漆膜,涂层",
    trigger_processes: "验收,检查",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GB 55006-2021",
    standard_name: "钢结构通用规范",
    clause_no: "4.4.6",
    clause_title: "动载禁止焊缝型式",
    clause_text: "钢结构承受动荷载且需进行疲劳验算时，严禁使用塞焊、槽焊、电渣焊和气电立焊接头。",
    audit_points:
      "承受动荷载且需疲劳验算时严禁使用塞焊、槽焊、电渣焊、气电立焊接头；本规范为全文强制性规范；吊车梁、桥梁、海洋平台等动载结构须重点审核接头型式。",
    profession: "steel-structure",
    structure_type: null,
    trigger_materials: "动载结构焊缝,吊车梁,疲劳构件",
    trigger_processes: "焊接,设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB 50205-2020",
    standard_name: "钢结构工程施工质量验收标准",
    clause_no: "10.9.1",
    clause_title: "主体结构整体偏差",
    clause_text:
      "主体钢结构整体立面偏移和整体平面弯曲的允许偏差应符合表10.9.1的规定。其中：主体结构的整体立面偏移单层为H/1000且不大于25.0mm；高度60m以下的多高层为(H/2500+10)且不大于30.0mm；高度60m至100m的高层为(H/2500+10)且不大于50.0mm；高度100m以上的高层为(H/2500+10)且不大于80.0mm；主体结构的整体平面弯曲为l/1500且不大于50.0mm。检查数量：对主要立面全部检查，对每个所检查的立面，除两列角柱外，尚应至少选取一列中间柱。",
    audit_points:
      "整体立面偏移：单层H/1000且≤25mm、多高层≤60m H/2500+10且≤30mm、60-100m≤50mm、>100m≤80mm；整体平面弯曲l/1500且≤50mm；主要立面全部检查且每立面至少含一列中间柱。",
    profession: "steel-structure",
    structure_type: null,
    trigger_materials: "主体钢结构,钢柱,钢梁",
    trigger_processes: "验收,检查,监测",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GB 50205-2020",
    standard_name: "钢结构工程施工质量验收标准",
    clause_no: "6.3.3",
    clause_title: "高强螺栓终拧质量检查",
    clause_text:
      "高强度螺栓连接副应在终拧完成1h后、48h内进行终拧质量检查，检查结果应符合本标准附录B的规定。检查数量：按节点数抽查10%，且不少于10个，每个被抽查到的节点，按螺栓数抽查10%，且不少于2个。",
    audit_points:
      "终拧检查时间终拧后1h~48h内；节点数抽查10%且≥10个；每节点螺栓数抽查10%且≥2个；扭剪型未拧掉梅花头螺栓数≤节点5%。",
    profession: "steel-structure",
    structure_type: null,
    trigger_materials: "高强度螺栓,连接副,扭剪型螺栓,摩擦面试件",
    trigger_processes: "验收,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  // ═══════════════════════════════════════════════════════════════════
  // 装配式专业（profession="prefabricated-concrete"）
  // 来源：11装配式建筑混凝土预制构件安装工程。构造轴=吊装/灌浆套筒/墙板 +通用
  // ═══════════════════════════════════════════════════════════════════
  {
    standard_code: "JGJ 1-2014",
    standard_name: "装配式混凝土结构技术规程",
    clause_no: "4.1.5",
    clause_title: "预制构件吊环材料",
    clause_text: "预制构件的吊环应采用未经冷加工的HPB300级钢筋制作。吊装用内埋式螺母或吊杆的材料应符合国家现行相关标准的规定。",
    audit_points:
      "吊环严禁采用冷加工钢筋（冷拉/冷拔），必须使用HPB300级热轧光圆钢筋；内埋式螺母/吊杆应有符合标准的产品证明文件。",
    profession: "prefabricated-concrete",
    structure_type: "预制构件吊装",
    trigger_materials: "预制构件吊环,内埋式螺母,吊杆,HPB300钢筋",
    trigger_processes: "吊装,设计计算,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 1-2014",
    standard_name: "装配式混凝土结构技术规程",
    clause_no: "12.1.4",
    clause_title: "吊装用吊具设计验算",
    clause_text: "吊装用吊具应按国家现行有关标准的规定进行设计、验算或试验检验。",
    audit_points:
      "吊具应提供设计计算书或试验检验报告，无验算依据不得投入使用；特种非标吊具应专项设计计算。",
    profession: "prefabricated-concrete",
    structure_type: "预制构件吊装",
    trigger_materials: "吊具,吊索,分配梁,起重设备",
    trigger_processes: "吊装,设计计算,验算,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 51231-2016",
    standard_name: "装配式混凝土建筑技术标准",
    clause_no: "9.8.1(3)",
    clause_title: "吊索水平夹角",
    clause_text: "吊索水平夹角不宜小于60°，不应小于45°。",
    audit_points:
      "吊索与水平面夹角宜≥60°，任何工况下不应小于45°；夹角过小将显著增大吊索内力与构件水平挤压，需通过分配梁调整。",
    profession: "prefabricated-concrete",
    structure_type: "预制构件吊装",
    trigger_materials: "吊索,吊具,分配梁",
    trigger_processes: "吊装,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 51231-2016",
    standard_name: "装配式混凝土建筑技术标准",
    clause_no: "9.8.1(4)",
    clause_title: "吊运操作方式",
    clause_text: "应采用慢起、稳升、缓放的操作方式，吊运过程应保持稳定，不得偏斜、摇摆和扭转，严禁吊装构件长时间悬停在空中。",
    audit_points:
      "操作必须慢起稳升缓放，严禁长时间空中悬停；发现偏斜、摇摆、扭转应立即停工校正。",
    profession: "prefabricated-concrete",
    structure_type: "预制构件吊装",
    trigger_materials: "预制构件,起重设备",
    trigger_processes: "吊装,监测",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 51231-2016",
    standard_name: "装配式混凝土建筑技术标准",
    clause_no: "9.8.1(5)",
    clause_title: "大型构件吊具加固",
    clause_text: "吊装大型构件、薄壁构件或形状复杂的构件时，应使用分配梁或分配桁架类吊具，并应采取避免构件变形和损伤的临时加固措施。",
    audit_points:
      "大型/薄壁/异形构件应使用分配梁或分配桁架，应同步设置临时加固；未设分配梁的不得起吊。",
    profession: "prefabricated-concrete",
    structure_type: "预制构件吊装",
    trigger_materials: "分配梁,分配桁架,临时加固材料,大型预制墙板,薄壁构件",
    trigger_processes: "吊装,设计计算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 1-2014",
    standard_name: "装配式混凝土结构技术规程",
    clause_no: "11.1.4",
    clause_title: "套筒接头抗拉强度试验(强条)",
    clause_text:
      "预制结构构件采用钢筋套筒灌浆连接时，应在构件生产前进行钢筋套筒灌浆连接接头的抗拉强度试验，每种规格的连接接头试件数量不应少于3个。",
    audit_points:
      "强制性条文：必须在生产前进行抗拉强度试验，每种规格接头试件不应少于3个；无合格试验报告严禁批量生产。",
    profession: "prefabricated-concrete",
    structure_type: "钢筋灌浆套筒连接",
    trigger_materials: "灌浆套筒,钢筋,灌浆料,接头试件",
    trigger_processes: "验收,检查,注浆",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 1-2014",
    standard_name: "装配式混凝土结构技术规程",
    clause_no: "12.1.5",
    clause_title: "灌浆前现场模拟接头",
    clause_text:
      "钢筋套筒灌浆前，应在现场模拟构件连接接头的灌浆方式，每种规格钢筋应制作不少于3个套筒灌浆连接接头，进行灌浆及相关检验。",
    audit_points:
      "现场应按相同工艺做模拟灌浆接头，每种规格钢筋不少于3个，合格后方可大面积灌浆作业。",
    profession: "prefabricated-concrete",
    structure_type: "钢筋灌浆套筒连接",
    trigger_materials: "灌浆套筒,钢筋,灌浆料,模拟接头试件",
    trigger_processes: "注浆,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 1-2014",
    standard_name: "装配式混凝土结构技术规程",
    clause_no: "12.3.4",
    clause_title: "套筒灌浆作业要求",
    clause_text:
      "钢筋套筒灌浆连接接头、钢筋浆锚搭接连接接头应按检验批划分要求及时灌浆，灌浆作业应符合下列规定:1灌浆施工时,环境温度不应低于5℃;当连接部位养护温度低于10℃时,应采取加热保温措施;2灌浆操作全过程应有专职检验人员负责旁站监督并及时形成施工质量检查记录;3应按产品使用说明书的要求计量灌浆料和水的用量,并搅拌均匀;每次拌制的灌浆料拌合物应进行流动度的检测;4灌浆作业应采用压浆法从下口灌注,当浆料从上口流出后应及时封堵,必要时可设分仓进行灌浆;5灌浆料拌合物应在制备后30min内用完。",
    audit_points:
      "环境温度不应低于5℃，养护<10℃应加热保温；应采用压浆法自下口灌注至上口出浆；灌浆料应在30min内用完；应有专职人员旁站并形成记录；每拌应测流动度。",
    profession: "prefabricated-concrete",
    structure_type: "钢筋灌浆套筒连接",
    trigger_materials: "灌浆料,灌浆套筒,加热保温材料,分仓座浆料",
    trigger_processes: "注浆,监测,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 1-2014",
    standard_name: "装配式混凝土结构技术规程",
    clause_no: "13.2.3",
    clause_title: "灌浆料强度试件",
    clause_text:
      "钢筋套筒灌浆连接及浆锚搭接连接用的灌浆料强度应满足设计要求。检查数量:按批检验,以每层为一检验批;每工作班应制作一组且每层不应少于3组40mm×40mm×160mm的长方体试件,标准养护28d后进行抗压强度试验。",
    audit_points:
      "灌浆料强度按每层一检验批；每工作班至少1组、每层不应少于3组40×40×160mm试件，标养28d抗压；不满足不得通过验收。",
    profession: "prefabricated-concrete",
    structure_type: "钢筋灌浆套筒连接",
    trigger_materials: "灌浆料试件,试模",
    trigger_processes: "注浆,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 51231-2016",
    standard_name: "装配式混凝土建筑技术标准",
    clause_no: "10.4.2(3)",
    clause_title: "连接钢筋定位偏差",
    clause_text:
      "应检查被连接钢筋的规格、数量、位置和长度。当连接钢筋倾斜时,应进行校直;连接钢筋偏离套筒或孔洞中心线不宜超过3mm。连接钢筋中心位置存在严重偏差影响预制构件安装时,应会同设计单位制定专项处理方案,严禁随意切割、强行调整定位钢筋。",
    audit_points:
      "连接钢筋中心偏差不宜超过3mm；存在严重偏差严禁随意切割或强行调整，必须会同设计单位出专项处理方案。",
    profession: "prefabricated-concrete",
    structure_type: "钢筋灌浆套筒连接",
    trigger_materials: "连接钢筋,灌浆套筒,预留孔",
    trigger_processes: "安装,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 51231-2016",
    standard_name: "装配式混凝土建筑技术标准",
    clause_no: "11.3.3",
    clause_title: "灌浆饱满度主控项目",
    clause_text: "钢筋采用套筒灌浆连接、浆锚搭接连接时，灌浆应饱满、密实，所有出口均应出浆。",
    audit_points:
      "主控项目，全数检查：每个套筒所有出浆口均应出浆；任一出浆口未出浆即不合格，必须处理并复检。",
    profession: "prefabricated-concrete",
    structure_type: "钢筋灌浆套筒连接",
    trigger_materials: "灌浆料,灌浆套筒,浆锚搭接孔",
    trigger_processes: "注浆,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 1-2014",
    standard_name: "装配式混凝土结构技术规程",
    clause_no: "6.5.8",
    clause_title: "预制楼梯最小搁置长度",
    clause_text:
      "预制楼梯与支承构件之间宜采用简支连接。采用简支连接时,应符合下列规定:1预制楼梯宜一端设置固定铰,另一端设置滑动铰,其转动及滑动变形能力应满足结构层间位移的要求,且预制楼梯端部在支承构件上的最小搁置长度应符合表6.5.8的规定;2预制楼梯设置滑动铰的端部应采取防止滑落的构造措施。表6.5.8:抗震设防烈度6度75mm、7度75mm、8度100mm。",
    audit_points:
      "预制楼梯最小搁置长度：6度75mm、7度75mm、8度100mm；滑动铰端应设防止滑落构造。",
    profession: "prefabricated-concrete",
    structure_type: "预制墙板安装",
    trigger_materials: "预制楼梯,支承构件",
    trigger_processes: "安装,设计计算,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 1-2014",
    standard_name: "装配式混凝土结构技术规程",
    clause_no: "12.3.2",
    clause_title: "套筒/连接钢筋就位前检查",
    clause_text:
      "采用钢筋套筒灌浆连接、钢筋浆锚搭接连接的预制构件就位前,应检查下列内容:1套筒、预留孔的规格、位置、数量和深度;2被连接钢筋的规格、数量、位置和长度。当套筒、预留孔内有杂物时,应清理干净;当连接钢筋倾斜时,应进行校直。连接钢筋偏离套筒或孔洞中心线不宜超过5mm。",
    audit_points:
      "就位前应全数检查套筒/预留孔及连接钢筋规格、位置、数量、深度；套筒内杂物应清理；连接钢筋偏离套筒中心不宜超过5mm。",
    profession: "prefabricated-concrete",
    structure_type: "预制墙板安装",
    trigger_materials: "预制墙板,预制柱,灌浆套筒,连接钢筋",
    trigger_processes: "安装,检查,验收",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 1-2014",
    standard_name: "装配式混凝土结构技术规程",
    clause_no: "12.3.3",
    clause_title: "墙柱构件安装规定",
    clause_text:
      "墙、柱构件的安装应符合下列规定:1构件安装前,应清洁结合面;2构件底部应设置可调整接缝厚度和底部标高的垫块;3钢筋套筒灌浆连接接头、钢筋浆锚搭接连接接头灌浆前,应对接缝周围进行封堵,封堵措施应符合结合面承载力设计要求;4多层预制剪力墙底部采用坐浆材料时,其厚度不宜大于20mm。",
    audit_points:
      "墙柱安装前结合面应清洁；底部应设可调垫块；灌浆前接缝周围应封堵可靠；坐浆厚度不宜大于20mm。",
    profession: "prefabricated-concrete",
    structure_type: "预制墙板安装",
    trigger_materials: "预制墙板,预制柱,坐浆料,垫块,封堵材料",
    trigger_processes: "安装,注浆,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 51231-2016",
    standard_name: "装配式混凝土建筑技术标准",
    clause_no: "10.3.4",
    clause_title: "竖向构件临时支撑",
    clause_text:
      "竖向预制构件安装采用临时支撑时,应符合下列规定:1预制构件的临时支撑不宜少于2道;2对预制柱、墙板构件的上部斜支撑,其支撑点距离板底的距离不宜小于构件高度的2/3,且不应小于构件高度的1/2;斜支撑应与构件可靠连接;3构件安装就位后,可通过临时支撑对构件的位置和垂直度进行微调。",
    audit_points:
      "竖向构件临时支撑不宜少于2道；上部斜支撑支撑点距板底不应小于构件高度1/2、宜≥2/3；斜撑与构件应可靠连接。",
    profession: "prefabricated-concrete",
    structure_type: "预制墙板安装",
    trigger_materials: "临时支撑,斜撑,可调节支撑",
    trigger_processes: "安装,验算,拆除",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "GB/T 51231-2016",
    standard_name: "装配式混凝土建筑技术标准",
    clause_no: "9.8.3",
    clause_title: "预制构件成品保护",
    clause_text:
      "预制构件成品保护应符合下列规定:1预制构件成品外露保温板应采取防止开裂措施,外露钢筋应采取防弯折措施,外露预埋件和连结件等外露金属件应按不同环境类别进行防护或防腐、防锈;2宜采取保证吊装前预埋螺栓孔清洁的措施;3钢筋连接套筒、预埋孔洞应采取防止堵塞的临时封堵措施;4露骨料粗糙面冲洗完成后应对灌浆套筒的灌浆孔和出浆孔进行透光检查,并清理灌浆套筒内的杂物;5冬期生产和存放的预制构件的非贯穿孔洞应采取措施防止雨雪水进入发生冻胀损坏。",
    audit_points:
      "外露钢筋应防弯折、外露金属件应防腐防锈；套筒、预留孔应临时封堵防堵塞；露骨料冲洗后应对套筒灌浆/出浆孔做透光检查；冬期非贯穿孔应防雨雪冻胀。",
    profession: "prefabricated-concrete",
    structure_type: null,
    trigger_materials: "预制构件成品,套筒封堵件,防腐防锈材料",
    trigger_processes: "检查,验收,安装",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GB/T 51129-2017",
    standard_name: "装配式建筑评价标准",
    clause_no: "3.0.3",
    clause_title: "装配式建筑认定门槛",
    clause_text:
      "装配式建筑应同时满足下列要求:1主体结构部分的评价分值不低于20分;2围护墙和内隔墙部分的评价分值不低于10分;3采用全装修;4装配率不低于50%。",
    audit_points:
      "装配式建筑应同时满足四项：主体结构≥20分、围护墙与内隔墙≥10分、全装修、装配率≥50%；任一不满足不得评价为装配式建筑。",
    profession: "prefabricated-concrete",
    structure_type: null,
    trigger_materials: "装配率计算书,评价表",
    trigger_processes: "验收,检查",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "GB/T 51129-2017",
    standard_name: "装配式建筑评价标准",
    clause_no: "5.0.1~5.0.2",
    clause_title: "装配率评价等级",
    clause_text:
      "当评价项目满足本标准第3.0.3条规定,且主体结构竖向构件中预制部品部件的应用比例不低于35%时,可进行装配式建筑等级评价。装配式建筑评价等级应划分为A级、AA级、AAA级:装配率为60%~75%时,评价为A级装配式建筑;装配率为76%~90%时,评价为AA级装配式建筑;装配率为91%及以上时,评价为AAA级装配式建筑。",
    audit_points:
      "竖向构件预制比例不应低于35%；A级60%~75%、AA级76%~90%、AAA级≥91%；装配率<60%不得评级。",
    profession: "prefabricated-concrete",
    structure_type: null,
    trigger_materials: "预制部品部件清单,装配率计算书",
    trigger_processes: "验收,检查",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  // ═══════════════════════════════════════════════════════════════════
  // 起重吊装补充：大型设备吊装/流动式起重机命门（JGJ 276-2012）
  // 针对 350t 级盾构机/大型构件双机抬吊等场景，补试吊/吊索/吊点/地锚/警戒/斜拉禁令
  // 注：吊耳强度（材质/焊缝/孔壁承压）专项条款本 folder 无（属设备吊耳专用标准如 HG/T 21574）
  // ═══════════════════════════════════════════════════════════════════
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "3.0.5",
    clause_title: "吊装道路承载力与作业区警戒",
    clause_text:
      "起重设备的通行道路应平整，承载力应满足设备通行要求。吊装作业区域四周应设置明显标志，严禁非操作人员入内。夜间不宜作业，当确需夜间作业时，应有足够的照明。",
    audit_points:
      "核对：①起重设备通行道路平整、地耐力满足要求（重型履带吊/汽车吊须验算地基承载力+铺路基箱/钢板）；②吊装区域四周设明显标志+警戒隔离、严禁非操作人员入内；③夜间作业须足够照明（一般不宜夜吊）。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "履带吊,汽车吊,起重设备,路基箱,垫板,警戒标志",
    trigger_processes: "吊装,验算,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "3.0.7",
    clause_title: "吊索卡环规格须计算+起吊前检查",
    clause_text:
      "绑扎所用的吊索、卡环、绳扣等的规格应根据计算确定。起吊前，应对起重机钢丝绳及连接部位和吊具进行检查。",
    audit_points:
      "①吊索、卡环、绳扣规格必须经计算确定（按构件重量+吊索夹角算拉力，不能凭经验选）；②起吊前检查起重机钢丝绳、连接部位、吊具。方案未附吊索/卡环选型计算书即不符合。③吊耳/吊具板件应力计算：正应力 σ=N/A、孔壁剪应力 τ=P/(2(R-r)t)（R=吊耳孔中心至边缘距离、r=孔半径、t=板厚），容许应力按吊具材料牌号查《钢结构设计标准》GB 50017-2017 表4.4.1 钢材强度设计值（Q235 抗拉抗压抗弯 f=215、抗剪 fv=125 N/mm²；Q345 f=305、fv=175）。安全系数须体现于容许应力折减（[f]=屈服强度/k），严禁直接乘在荷载上——方案若写 σ=k·N/A（k乘荷载）即不规范，须改为 σ=N/A≤[f]=fy/k。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "吊索,卡环,绳扣,钢丝绳,吊具",
    trigger_processes: "吊装,设计计算,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "3.0.11",
    clause_title: "大重构件/新工艺试吊",
    clause_text: "吊装大、重构件和采用新的吊装工艺时，应先进行试吊，确认无问题后，方可正式起吊。",
    audit_points:
      "「大、重构件」或「新工艺」必须先试吊、确认无问题方可正式起吊。盾构机等大型设备吊装属典型大重构件，方案须有试吊程序（离地、暂停、检查、再起升）。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "试吊,重型构件,大型设备",
    trigger_processes: "吊装,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "3.0.13",
    clause_title: "严禁斜拉斜吊",
    clause_text: "吊起的构件应确保在起重机吊杆顶的正下方，严禁采用斜拉、斜吊，严禁起吊埋于地下或粘结在地上的构件。",
    audit_points:
      "「严禁」斜拉斜吊——吊钩须在吊杆顶正下方、与吊点垂直；严禁起吊埋于地下/粘结在地上的构件。方案若存在斜拉脱困、拖拽吊装即违规。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "吊钩,吊杆,吊点",
    trigger_processes: "吊装",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "3.0.17",
    clause_title: "起吊离地200~300mm暂停检查",
    clause_text:
      "开始起吊时，应先将构件吊离地面200mm～300mm后暂停，检查起重机的稳定性、制动装置的可靠性、构件的平衡性和绑扎的牢固性等，确认无误后，方可继续起吊。已吊起的构件不得长久停滞在空中。严禁超载和吊装重量不明的重型构件和设备。",
    audit_points:
      "试吊命门：①构件吊离地面200~300mm后暂停；②检查起重机稳定性、制动可靠性、构件平衡性、绑扎牢固性；③确认无误方可继续；④已吊起构件不得长久空中停滞；⑤严禁超载+严禁吊重量不明重型构件（盾构机等须明确重量）。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "试吊,制动装置,构件,吊具",
    trigger_processes: "吊装,检查",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "4.3.1",
    clause_title: "吊索安全系数与水平夹角",
    clause_text:
      "钢丝绳吊索宜采用6×37型钢丝绳制作成环式或8股头式，其长度和直径应根据吊物的几何尺寸、重量和所用的吊装工具、吊装方法确定。吊索的绳环或两端的绳套可采用压接接头，压接接头的长度不应小于钢丝绳直径的20倍，且不应小于300mm。当利用吊索上的吊钩、卡环钩挂重物上的起重吊环时，吊索的安全系数不应小于6；当用吊索直接捆绑重物，且吊索与重物棱角间已采取妥善的保护措施时，吊索的安全系数应取6~8；当起吊重、大或精密的重物时，除应采取妥善保护措施外，吊索的安全系数应取10。吊索与所吊构件间的水平夹角宜大于45°。",
    audit_points:
      "吊索三控：①压接接头长度≥钢丝绳直径20倍且≥300mm；②安全系数：挂起重吊环≥6、直接捆绑（棱角保护）6~8、重/大/精密重物取10；③吊索与构件水平夹角宜>45°（夹角越小吊索受力越大，<45°须用平衡梁）。方案须附吊索拉力计算（按附录A）。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "吊索,钢丝绳,卡环,起重吊环,平衡梁",
    trigger_processes: "吊装,设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "4.5.4",
    clause_title: "地锚使用前试拉与专人看守",
    clause_text:
      "各式地锚的使用应符合下列规定：1地锚采用的木料应使用剥皮落叶松、杉木。严禁使用油松、杨木、柳木、桦木、椴木和腐朽、多节的木料。2绑扎地锚钢丝绳的绳环应牢固可靠，横卧木四角应采用长500mm的角钢加固，并应在角钢外再用长300mm的半圆钢管保护。3钢丝绳的方向应与地锚受力方向一致。4地锚使用前应进行试拉，合格后方可使用。埋设不明的地锚未经试拉不得使用。5地锚使用时应指定专人检查、看守，如发现变形应立即处理或加固。",
    audit_points:
      "地锚命门：①木料须落叶松/杉木（严禁油松/杨木/腐朽料）；②绳环牢固+横卧木四角500mm角钢加固；③钢丝绳方向与受力方向一致；④「使用前必须试拉」、埋设不明地锚未试拉不得使用；⑤专人检查看守、变形立即加固。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "地锚,缆风绳,卷扬机,横卧木",
    trigger_processes: "吊装,检查,验收",
    hazard_level: null,
    priority: 4,
    enabled: 1,
  },
  {
    standard_code: "JGJ 276-2012",
    standard_name: "建筑施工起重吊装工程安全技术规范",
    clause_no: "5.1.5",
    clause_title: "吊点/绑扎点位置须计算",
    clause_text:
      "吊点设置和构件绑扎应符合下列规定：1当构件无设计吊环（点）时，应通过计算确定绑扎点的位置。绑扎方法应可靠，且摘钩应简便安全。2当绑扎竖直吊升的构件时，绑扎点位置应略高于构件重心。",
    audit_points:
      "吊点命门：①构件无设计吊环（点）时，绑扎点位置「必须通过计算确定」（吊耳/吊点位置+数量须经强度+平衡计算，不能随意定）；②竖直吊升构件绑扎点略高于重心。盾构机等设备吊耳位置须由设计给出或经计算，方案须附吊点/吊耳计算书。",
    profession: "crane",
    structure_type: "流动式起重机",
    trigger_materials: "吊点,吊耳,吊环,绑扎点,构件",
    trigger_processes: "吊装,设计计算,验算",
    hazard_level: null,
    priority: 5,
    enabled: 1,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// DB 初始化与种子
// ─────────────────────────────────────────────────────────────────────────────

async function getClauseDb(): Promise<initSqlJs.Database> {
  const SQL = await initSqlJs()

  const dbDir = path.dirname(CLAUSE_DB_PATH)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const isNew = !fs.existsSync(CLAUSE_DB_PATH)
  const db = isNew
    ? new SQL.Database()
    : new SQL.Database(fs.readFileSync(CLAUSE_DB_PATH))

  // 幂等建表（老库新库都安全）
  db.run(`
    CREATE TABLE IF NOT EXISTS clause (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      standard_code TEXT NOT NULL,
      standard_name TEXT NOT NULL,
      clause_no TEXT NOT NULL,
      clause_title TEXT NOT NULL,
      clause_text TEXT NOT NULL,
      audit_points TEXT,
      profession TEXT NOT NULL,
      structure_type TEXT,
      trigger_materials TEXT,
      trigger_processes TEXT,
      hazard_level TEXT,
      priority INTEGER DEFAULT 3,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  // 幂等同步种子：每次都跑，已存在的跳过、新增的补入
  // （SEED_CLAUSES 增补新条款时，老库下次访问自动补入，无需删库重建、不覆盖人工修改）
  const inserted = syncSeedClauses(db)
  if (isNew || inserted > 0) {
    fs.writeFileSync(CLAUSE_DB_PATH, Buffer.from(db.export()))
    if (isNew) console.log(`[clause-db] 首次建库 → ${CLAUSE_DB_PATH}`)
  }

  return db
}

// ─────────────────────────────────────────────────────────────────────────────
// 强标通用锚点（profession="general"）：每次审核无条件带出（无论方案是哪个专业）
// 由 Hook2 的 general 豁免逻辑保证（见 getClausesByFeatures）。
// 数据源：lib/general-clauses.json —— 建办质63号/48号、住建部令37号/31号、粤建规范2号、
// 建质规5号、安全生产法、国务院令393号、GB55034/JGJ348/GB50870 等的【跨专业通用】条款。
// 注意：专业专属技术规范（JGJ130/JGJ·T231/JGJ162 等）不入此集，避免复活"轮扣式被扣件式污染"bug。
const GENERAL_CLAUSES_FILE = path.join(process.cwd(), "lib", "general-clauses.json")

const GENERAL_SEED_CLAUSES: SeedClause[] = (() => {
  if (!fs.existsSync(GENERAL_CLAUSES_FILE)) {
    console.warn(`[clause-db] 强标通用锚点文件缺失: ${GENERAL_CLAUSES_FILE}`)
    return []
  }
  try {
    const data = JSON.parse(fs.readFileSync(GENERAL_CLAUSES_FILE, "utf-8"))
    const groups: { clauses: Array<Partial<Clause>> }[] = Array.isArray(data?.groups) ? data.groups : []
    return groups.flatMap((g) =>
      (g.clauses ?? []).map((c) => ({
        standard_code: String(c.standard_code ?? ""),
        standard_name: String(c.standard_name ?? ""),
        clause_no: String(c.clause_no ?? ""),
        clause_title: String(c.clause_title ?? ""),
        clause_text: String(c.clause_text ?? ""),
        audit_points: c.audit_points ?? null,
        profession: "general",
        structure_type: null,
        trigger_materials: null,
        trigger_processes: null,
        hazard_level: null,
        priority: 4,
        enabled: 1,
      }))
    )
  } catch (e) {
    console.warn(`[clause-db] 强标通用锚点加载失败:`, e instanceof Error ? e.message : e)
    return []
  }
})()

function syncSeedClauses(db: initSqlJs.Database): number {
  const stmt = `INSERT INTO clause
    (standard_code, standard_name, clause_no, clause_title, clause_text, audit_points,
     profession, structure_type, trigger_materials, trigger_processes, hazard_level, priority, enabled)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  let inserted = 0
  let updated = 0
  const allSeed = [...SEED_CLAUSES, ...GENERAL_SEED_CLAUSES]
  for (const c of allSeed) {
    // 幂等：按 规范号+条款号 去重，已存在则跳过（保留人工对老记录的修改）
    const exists = db.exec(
      "SELECT 1 FROM clause WHERE standard_code = ? AND clause_no = ?",
      [c.standard_code, c.clause_no]
    )
    if (exists.length === 0) {
      db.run(stmt, [
        c.standard_code, c.standard_name, c.clause_no, c.clause_title, c.clause_text, c.audit_points,
        c.profession, c.structure_type, c.trigger_materials, c.trigger_processes, c.hazard_level, c.priority, c.enabled,
      ])
      inserted++
    } else if (seedClauseNeedsRefresh(db, c)) {
      db.run(
        `UPDATE clause
         SET standard_name = ?, clause_title = ?, clause_text = ?, audit_points = ?,
             profession = ?, structure_type = ?, trigger_materials = ?, trigger_processes = ?,
             hazard_level = ?, priority = ?, enabled = ?, updated_at = datetime('now','localtime')
         WHERE standard_code = ? AND clause_no = ?`,
        [
          c.standard_name, c.clause_title, c.clause_text, c.audit_points,
          c.profession, c.structure_type, c.trigger_materials, c.trigger_processes,
          c.hazard_level, c.priority, c.enabled,
          c.standard_code, c.clause_no,
        ]
      )
      updated++
    }
  }
  if (inserted > 0 || updated > 0) {
    console.log(`[clause-db] 同步种子条款: 新增 ${inserted} 条，刷新 ${updated} 条（专业种子 ${SEED_CLAUSES.length} + 强标通用 ${GENERAL_SEED_CLAUSES.length}）`)
  }
  return inserted + updated
}

function seedClauseNeedsRefresh(db: initSqlJs.Database, c: SeedClause): boolean {
  if (c.standard_code !== "建办质〔2021〕48号" || c.clause_no !== "（三）.2") return false

  const existing = db.exec(
    `SELECT standard_name, clause_title, clause_text, audit_points,
            profession, structure_type, trigger_materials, trigger_processes,
            hazard_level, priority, enabled
     FROM clause WHERE standard_code = ? AND clause_no = ?`,
    [c.standard_code, c.clause_no]
  )
  const row = existing[0]?.values[0]
  if (!row) return false

  const next = [
    c.standard_name, c.clause_title, c.clause_text, c.audit_points,
    c.profession, c.structure_type, c.trigger_materials, c.trigger_processes,
    c.hazard_level, c.priority, c.enabled,
  ]
  return next.some((value, index) => row[index] !== value)
}

// ─────────────────────────────────────────────────────────────────────────────
// 查询接口
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 取全部启用条款（Step 0 验证用；Step 1 将加 getClausesByFeatures 精准匹配）
 */
export async function getAllClauses(): Promise<Clause[]> {
  const db = await getClauseDb()
  const result = db.exec(
    `SELECT id, standard_code, standard_name, clause_no, clause_title, clause_text, audit_points,
            profession, structure_type, trigger_materials, trigger_processes, hazard_level,
            priority, enabled, created_at, updated_at
     FROM clause
     WHERE enabled = 1
     ORDER BY priority DESC, standard_code, clause_no`
  )
  db.close()

  if (result.length === 0) return []

  const cols = result[0].columns as string[]
  return result[0].values.map((row: unknown[]) => {
    const o: Record<string, unknown> = {}
    cols.forEach((c: string, i: number) => (o[c] = row[i]))
    return o as unknown as Clause
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1：Hook 2 · 精准匹配（getClausesByFeatures）
// ─────────────────────────────────────────────────────────────────────────────

/** 方案结构化特征（Hook 1 的输出 / Hook 2 的输入） */
export interface SchemeFeatures {
  profession: string
  structureType: string | null // 构造细分，如 "轮扣式"
  materials: string[] // 涉及材料
  processes: string[] // 关键工艺
  hazardLevel: string | null // 危大等级，如 "超规模"
  possibleStandards: string[] // 可能违反的规范号（辅助）
  lockedProfession?: string // 用户在 UI 锁定的专业 id；有值则 Hook2 只捞该专业条款
  hasExternalScaffolding?: boolean // 方案是否含外脚手架/卸料平台独立章节（方案B：决定脚手架通用条款是否带入）
}

/** 命中条款（带命中维度，便于调试与 Step 3 prompt 标注） */
export interface MatchedClause extends Clause {
  matchedBy: string[]
}

function splitTags(s: string | null): string[] {
  if (!s) return []
  return s.split(",").map((x) => x.trim()).filter(Boolean)
}

/**
 * Hook 2 · 弹药匹配：按方案特征精准捞条款
 * 命中维度（任一命中即捞）：
 *   1) 构造类型精确匹配（强信号，必捞）
 *   2) 触发材料交集
 *   3) 触发工艺交集
 *   4) 危大等级匹配
 *
 * 排序：命中维度多 → 相关性高，优先；其次 priority；其次条款号
 */
export async function getClausesByFeatures(features: SchemeFeatures): Promise<MatchedClause[]> {
  const all = await getAllClauses()
  const matched: MatchedClause[] = []

  for (const clause of all) {
    // 强标通用锚点（profession="general"）：无条件带出，不受专业锁定/构造过滤影响
    // （跨专业法规与通用依据，无论方案属哪个专业，每次审核必带、且排前）
    if (clause.profession === "general") {
      matched.push({ ...clause, matchedBy: ["【强标·必审】"] })
      continue
    }
    // 用户锁定专业时，只保留该专业条款（构造专属 + 本专业通用），彻底隔离跨专业污染
    if (features.lockedProfession && clause.profession !== features.lockedProfession) continue

    // 未锁定时按识别主专业过滤（治跨专业污染：起重方案命中模板监测 DBJ/T 15-197、
    // 模板方案命中脚手架条款等——memory 早记的 bug，未锁定时爆发）。
    // general 强标已在上方无条件带出；识别失败(profession=unknown)时降级不过滤兼容兜底；
    // 例外：模板方案探测到外架章节(hasExternalScaffolding)时，允许脚手架条款带入（模板+外架混合方案）。
    if (!features.lockedProfession && features.profession !== "unknown" && clause.profession !== features.profession) {
      if (!(clause.profession === "scaffolding" && features.hasExternalScaffolding)) continue
    }

    // 方案B：脚手架通用条款（profession=scaffolding 且不绑构造，如 GB55023 连墙件/搭设同步/卸料平台禁令）
    // 在「主专业非脚手架 + 方案无外架/平台独立章节」时跳过——避免模板方案靠"剪刀撑/立杆"等共性材料词
    // 误捞外架作业条款（清华附中高大模板报告 150 条噪音、意见7 用搭设同步条款审浇筑顺序的根因）。
    // 模板+外架混合方案探测到外架章节时照常带入。
    if (
      clause.profession === "scaffolding" &&
      !clause.structure_type &&
      features.profession !== "scaffolding" &&
      !features.hasExternalScaffolding
    ) continue

    const by: string[] = []

    if (clause.structure_type) {
      // 构造专属条款（如轮扣式/盘扣式专属）：仅当构造类型精确匹配才捞
      // 不靠材料/工艺跨构造捞，避免把轮扣式条款误用于盘扣式方案（两者数值常不同）
      if (features.structureType === clause.structure_type) {
        by.push(`构造类型=${clause.structure_type}`)
      }
    } else {
      // 通用条款（不限构造）：靠材料/工艺/危大维度捞
      const cm = splitTags(clause.trigger_materials)
      if (features.materials.length && cm.length) {
        const hit = features.materials.filter((m) => cm.includes(m))
        if (hit.length) by.push(`材料:${hit.join(",")}`)
      }
      const cp = splitTags(clause.trigger_processes)
      if (features.processes.length && cp.length) {
        const hit = features.processes.filter((p) => cp.includes(p))
        if (hit.length) by.push(`工艺:${hit.join(",")}`)
      }
      if (features.hazardLevel && clause.hazard_level === features.hazardLevel) {
        by.push(`危大=${clause.hazard_level}`)
      }
    }

    if (by.length) {
      matched.push({ ...clause, matchedBy: by })
    }
  }

  matched.sort((a, b) => {
    // 1) 强标通用（general）排最前，先于一切专业/构造条款
    const ag = a.profession === "general" ? 1 : 0
    const bg = b.profession === "general" ? 1 : 0
    if (ag !== bg) return bg - ag

    // 2) 体系专用优先：同主题下 structure_type===方案构造的排前，通用(structure_type=null)排后
    //    让盘扣式方案优先引 JGJ/T 231 专用（如6.2.2竖向斜杆布置），而非退到 JGJ 300 通用剪刀撑
    const st = features.structureType
    if (st) {
      const aSpec = a.structure_type === st ? 1 : 0
      const bSpec = b.structure_type === st ? 1 : 0
      if (aSpec !== bSpec) return bSpec - aSpec
    }

    if (b.matchedBy.length !== a.matchedBy.length) return b.matchedBy.length - a.matchedBy.length
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.clause_no.localeCompare(b.clause_no)
  })

  return matched
}
