import { Workbook } from "exceljs"

import { buildExcelReportBlob } from "../lib/review/report-excel-export"

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

### 缺陷1：施工设计计算书缺失

- **【问题描述】** 施工设计计算书缺失。
- **【整改要求/建议】** 补充完整计算书。
`

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object" && "richText" in value) {
    return (value.richText as Array<{ text: string }>).map((part) => part.text).join("")
  }
  return String(value)
}

async function main(): Promise<void> {
  const blob = await buildExcelReportBlob(sampleReport)
  assert(
    blob.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Excel 导出使用标准 XLSX MIME 类型"
  )

  const workbook = new Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())
  const worksheet = workbook.getWorksheet("审核报告")
  assert(Boolean(worksheet), "XLSX 包含审核报告工作表")
  if (!worksheet) process.exit(1)

  const rows = worksheet.getRows(1, worksheet.rowCount) ?? []
  const textRows = rows.map((row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    return values.map(cellText)
  })
  const findRow = (text: string) => textRows.findIndex((values) => values.includes(text)) + 1
  const completenessHeadingRow = findRow("3. 完整性必审项核查")
  const tableHeaderRow = findRow("序号")
  const narrativeRow = findRow("工程名称： 清华附中高大模板工程")

  assert(worksheet.views[0]?.showGridLines === false, "工作表隐藏默认网格线")
  assert(worksheet.getCell("A1").value === "清华附中高大模板方案审核报告", "报告标题不保留 Markdown 符号")
  assert(worksheet.getCell("A1").isMerged, "报告标题使用合并单元格")
  assert(completenessHeadingRow > 0, "完整性必审项章节正常输出")
  assert(tableHeaderRow > completenessHeadingRow, "完整性核查生成真实表头")
  assert(worksheet.getRow(tableHeaderRow).cellCount === 5, "完整性核查使用五列表格")
  assert(cellText(worksheet.getCell(tableHeaderRow, 3).value) === "核查结论", "核查结论使用紧凑表头")
  assert(worksheet.getCell(tableHeaderRow, 1).border.top?.style === "thin", "真实表格保留必要边框")
  assert(narrativeRow > 0, "正文内容已解析为可阅读文字")
  assert(!worksheet.getCell(narrativeRow, 1).border.top?.style, "叙述性正文不使用表格边框")
  assert(worksheet.getColumn(5).width === 62, "方案对应内容列保留主列宽度")

  const allText = textRows.flat().join("\n")
  assert(!allText.includes("| 序号 |"), "XLSX 不保留 Markdown 表格竖线")
  assert(!allText.includes("## "), "XLSX 不保留 Markdown 标题符号")
  assert(!allText.includes("**"), "XLSX 不保留 Markdown 加粗符号")

  if (process.exitCode) {
    console.error("\nFAIL: Excel 原生导出检查未通过")
    process.exit(process.exitCode)
  }

  console.log("\nPASS: Excel 原生导出检查通过")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
