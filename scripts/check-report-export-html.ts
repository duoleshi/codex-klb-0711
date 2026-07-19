import {
  buildPrintableReportHtml,
  buildWordReportHtml,
} from "../lib/review/report-export"

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

function checkCommonReportHtml(html: string): void {
  assert(html.includes("<h1>"), "Markdown 一级标题转换为 HTML 标题")
  assert(html.includes("<h2>3. 完整性必审项核查</h2>"), "完整性章节标题正常渲染")
  assert(html.includes("<strong>工程名称：</strong>"), "Markdown 加粗转换为 strong")
  assert(html.includes('<table class="completeness-table">'), "完整性核查转换为专用表格")
  assert(html.includes("<thead>"), "表格包含可重复的表头")
  assert(html.includes("<tbody>"), "表格包含数据行")
  assert(html.includes('<col style="width:6%">'), "序号列使用紧凑列宽")
  assert(html.includes('<col style="width:45%">'), "方案对应内容使用主列宽度")
  assert(!html.includes("核查结论（已提供/缺失/不完整/不适用）"), "导出表格使用紧凑的核查结论表头")
  assert(html.includes('<span class="status status-critical">致命缺陷</span>'), "问题等级渲染为可识别状态")
  assert(!html.includes("<pre>"), "整篇报告不再作为纯文本输出")
  assert(!html.includes("| 序号 | 必审项 |"), "不保留 Markdown 表格竖线语法")
  assert(html.includes("thead { display: table-header-group; }"), "PDF 跨页时重复表头")
  assert(html.includes('"Hiragino Sans GB"'), "Word/PDF 导出包含 macOS 中文字体回退")
}

function main(): void {
  const printableHtml = buildPrintableReportHtml(sampleReport)
  checkCommonReportHtml(printableHtml)
  assert(printableHtml.includes("@page { size: A4 portrait;"), "PDF 输出使用 A4 纸张样式")

  const wordHtml = buildWordReportHtml(sampleReport)
  checkCommonReportHtml(wordHtml)
  assert(wordHtml.includes("urn:schemas-microsoft-com:office:word"), "Word 输出包含 Office 命名空间")
  assert(wordHtml.includes("mso-table-lspace:0pt"), "Word 表格使用 Office 兼容样式")

  if (process.exitCode) {
    console.error("\nFAIL: 报告导出 HTML 检查未通过")
    process.exit(process.exitCode)
  }

  console.log("\nPASS: 报告导出 HTML 检查通过")
}

main()
