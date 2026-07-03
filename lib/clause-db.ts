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

function syncSeedClauses(db: initSqlJs.Database): number {
  const stmt = `INSERT INTO clause
    (standard_code, standard_name, clause_no, clause_title, clause_text, audit_points,
     profession, structure_type, trigger_materials, trigger_processes, hazard_level, priority, enabled)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  let inserted = 0
  for (const c of SEED_CLAUSES) {
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
    }
  }
  if (inserted > 0) {
    console.log(`[clause-db] 同步种子条款: 新增 ${inserted} 条（共 ${SEED_CLAUSES.length} 条种子）`)
  }
  return inserted
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
    if (b.matchedBy.length !== a.matchedBy.length) return b.matchedBy.length - a.matchedBy.length
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.clause_no.localeCompare(b.clause_no)
  })

  return matched
}
