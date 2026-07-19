import JSZip from "jszip"

import { buildWordReportBlob } from "../lib/review/report-word-export"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const sampleReport = `# 清华附中高大模板方案审核报告

## 1. 基本信息

**工程名称：** 清华附中高大模板工程

## 3. 完整性必审项核查

| 序号 | 必审项 | 核查结论（已提供/缺失/不完整/不适用） | 问题等级 | 方案对应内容 |
|:---:|:---|:---:|:---:|:---|
| 1 | 工程及周边环境描述 | 不完整 | 管理问题 | 第一章有工程概况，但未描述周边环境。 |
| 2 | 施工设计计算书 | 缺失 | 致命缺陷 | 全文无独立计算书。 |

## 4. 致命缺陷审核

- **【问题描述】** 施工设计计算书缺失。
`

async function main(): Promise<void> {
  const blob = await buildWordReportBlob(sampleReport)
  assert(
    blob.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Word 导出使用标准 DOCX MIME 类型"
  )

  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const documentXml = await zip.file("word/document.xml")?.async("string") ?? ""
  const stylesXml = await zip.file("word/styles.xml")?.async("string") ?? ""

  assert(Boolean(documentXml), "DOCX 包含 Word 主文档 XML")
  assert(Boolean(stylesXml), "DOCX 包含 Word 样式 XML")
  assert(documentXml.includes("<w:tbl>"), "完整性核查生成 Word 原生表格")
  assert(documentXml.includes("<w:tblHeader"), "完整性表格设置跨页重复表头")
  assert(documentXml.includes('<w:gridCol w:w="626"'), "序号列使用 6% 紧凑宽度")
  assert(documentXml.includes('<w:gridCol w:w="4694"'), "方案对应内容使用 45% 主列宽度")
  assert(documentXml.includes("清华附中高大模板方案审核报告"), "DOCX 保留中文报告标题")
  assert(documentXml.includes("施工设计计算书"), "DOCX 保留表格中文内容")
  assert(!documentXml.includes("| 序号 | 必审项 |"), "DOCX 不保留 Markdown 表格竖线语法")
  assert(stylesXml.includes("ReviewTitle"), "DOCX 包含报告标题样式")
  assert(stylesXml.includes("Microsoft YaHei"), "DOCX 样式包含中文字体")

  if (process.exitCode) {
    console.error("\nFAIL: Word 原生导出检查未通过")
    process.exit(process.exitCode)
  }

  console.log("\nPASS: Word 原生导出检查通过")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
