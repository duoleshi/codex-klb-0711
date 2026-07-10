import { getAllClauses } from "../lib/clause-db"
import fs from "fs"
import path from "path"

type ProfessionExpectation = {
  id: string
  name: string
  count: number
  doc: string
  script: string
  sections: string[]
}

const EXPECTATIONS: ProfessionExpectation[] = [
  {
    id: "curtain-wall",
    name: "建筑幕墙安装工程",
    count: 17,
    doc: "建筑幕墙安装工程审核清单.md",
    script: "export-curtain-wall-checklist.ts",
    sections: ["幕墙通用条款", "构件式幕墙", "单元式幕墙", "点支承幕墙", "高频易错点"],
  },
  {
    id: "pile",
    name: "人工挖孔桩工程",
    count: 12,
    doc: "人工挖孔桩工程审核清单.md",
    script: "export-pile-checklist.ts",
    sections: ["人工挖孔桩通用条款", "高频易错点"],
  },
  {
    id: "steel-structure",
    name: "钢结构安装工程",
    count: 22,
    doc: "钢结构安装工程审核清单.md",
    script: "export-steel-structure-checklist.ts",
    sections: ["钢结构通用条款", "焊接连接", "高强螺栓连接", "钢构件吊装", "网架安装", "高频易错点"],
  },
  {
    id: "underwater",
    name: "水下作业工程",
    count: 8,
    doc: "水下作业工程审核清单.md",
    script: "export-underwater-checklist.ts",
    sections: ["水下作业通用条款", "高频易错点"],
  },
  {
    id: "prefabricated-concrete",
    name: "装配式建筑混凝土预制构件安装工程",
    count: 18,
    doc: "装配式建筑混凝土预制构件安装工程审核清单.md",
    script: "export-prefabricated-concrete-checklist.ts",
    sections: ["装配式通用条款", "预制构件吊装", "钢筋灌浆套筒连接", "预制墙板安装", "高频易错点"],
  },
  {
    id: "new-technology",
    name: "采用新技术、新工艺、新材料、新设备工程",
    count: 8,
    doc: "采用新技术新工艺新材料新设备工程审核清单.md",
    script: "export-new-technology-checklist.ts",
    sections: ["四新工程通用条款", "高频易错点"],
  },
  {
    id: "limited-space",
    name: "有限空间作业",
    count: 14,
    doc: "有限空间作业审核清单.md",
    script: "export-limited-space-checklist.ts",
    sections: ["有限空间作业通用条款", "高频易错点"],
  },
]

function assert(condition: unknown, message: string) {
  if (condition) {
    console.log(`PASS: ${message}`)
  } else {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
  }
}

function readIfExists(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : ""
}

async function main() {
  const root = process.cwd()
  const clauses = await getAllClauses()

  for (const expectation of EXPECTATIONS) {
    const professionClauses = clauses.filter((c) => c.profession === expectation.id)
    assert(
      professionClauses.length === expectation.count,
      `${expectation.name} 条款数量为 ${expectation.count} 条，当前 ${professionClauses.length} 条`
    )

    const scriptPath = path.join(root, "scripts", expectation.script)
    assert(fs.existsSync(scriptPath), `存在 ${expectation.name} 审核清单导出脚本`)

    const docPath = path.join(root, "docs", expectation.doc)
    const doc = readIfExists(docPath)
    assert(doc.includes(`# ${expectation.name}审核清单`), `${expectation.name} 审核清单标题正确`)
    for (const section of expectation.sections) {
      assert(doc.includes(section), `${expectation.name} 审核清单包含 ${section}`)
    }
  }

  const manual = readIfExists(path.join(root, "docs", "危大工程方案智能审核系统产品手册.md"))
  assert(manual.includes("十三专业审核清单"), "产品手册升级为十三专业审核清单")
  for (const expectation of EXPECTATIONS) {
    assert(manual.includes(expectation.name), `产品手册包含 ${expectation.name}`)
  }

  if (process.exitCode) {
    process.exit(process.exitCode)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
