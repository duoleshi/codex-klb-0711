import type { ProfessionType } from "./profession-types"

export type { ProfessionType } from "./profession-types"

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
  },
]
