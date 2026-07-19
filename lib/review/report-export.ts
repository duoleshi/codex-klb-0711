import { marked, Renderer } from "marked"

import { normalizeReviewMarkdown } from "./report-markdown"

const COMPLETENESS_COLUMNS = `
  <colgroup>
    <col style="width:6%">
    <col style="width:25%">
    <col style="width:12%">
    <col style="width:12%">
    <col style="width:45%">
  </colgroup>`

const REPORT_STYLES = `
  @page { size: A4 portrait; margin: 14mm 13mm 16mm; }
  * { box-sizing: border-box; }
  html { background: #ffffff; }
  body {
    margin: 0 auto;
    max-width: 184mm;
    color: #17202a;
    background: #ffffff;
    font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", STHeiti, "Arial Unicode MS", SimSun, sans-serif;
    font-size: 10.5pt;
    line-height: 1.68;
    word-break: break-word;
  }
  h1 {
    margin: 0 0 18pt;
    padding-bottom: 10pt;
    border-bottom: 2pt solid #174c3c;
    color: #123f33;
    font-size: 20pt;
    line-height: 1.35;
    text-align: center;
  }
  h2 {
    margin: 20pt 0 10pt;
    padding: 5pt 0 5pt 9pt;
    border-left: 3pt solid #174c3c;
    color: #173f35;
    font-size: 14.5pt;
    line-height: 1.4;
    page-break-after: avoid;
  }
  h3 {
    margin: 15pt 0 7pt;
    color: #22352f;
    font-size: 12pt;
    line-height: 1.45;
    page-break-after: avoid;
  }
  p { margin: 5pt 0; }
  strong { color: #142b25; font-weight: 700; }
  ul, ol { margin: 5pt 0 8pt; padding-left: 20pt; }
  li { margin: 2.5pt 0; }
  blockquote {
    margin: 8pt 0;
    padding: 6pt 9pt;
    border-left: 3pt solid #8aa89f;
    background: #f4f8f6;
    color: #40534d;
  }
  code {
    padding: 1pt 3pt;
    border-radius: 2pt;
    background: #f1f4f3;
    font-family: Consolas, "Courier New", monospace;
    font-size: 9.5pt;
  }
  hr { margin: 14pt 0; border: 0; border-top: 0.75pt solid #d8dfdc; }
  table {
    width: 100%;
    margin: 8pt 0 12pt;
    border-collapse: collapse;
    table-layout: fixed;
    mso-table-lspace:0pt;
    mso-table-rspace:0pt;
  }
  thead { display: table-header-group; }
  tbody { display: table-row-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th, td {
    border: 0.75pt solid #b8c7c1;
    padding: 6pt 5pt;
    vertical-align: top;
    text-align: left;
    line-height: 1.52;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  th {
    background: #eaf2ef;
    color: #183e33;
    font-weight: 700;
    text-align: center;
    vertical-align: middle;
  }
  .completeness-table th:nth-child(1),
  .completeness-table td:nth-child(1),
  .completeness-table th:nth-child(3),
  .completeness-table td:nth-child(3),
  .completeness-table th:nth-child(4),
  .completeness-table td:nth-child(4) { text-align: center; vertical-align: middle; }
  .status {
    display: inline-block;
    padding: 1pt 4pt;
    border: 0.75pt solid #cbd5d1;
    border-radius: 2pt;
    font-size: 9pt;
    font-weight: 700;
    white-space: nowrap;
  }
  .status-ok { border-color: #86c9ad; background: #edf9f3; color: #176745; }
  .status-warning { border-color: #e8bf66; background: #fff8e5; color: #8a5700; }
  .status-critical { border-color: #ec9b9b; background: #fff0f0; color: #a32121; }
  .status-management { border-color: #8ebee2; background: #eff7fd; color: #155b8f; }
  .report-footer {
    margin-top: 18pt;
    padding-top: 8pt;
    border-top: 0.75pt solid #d8dfdc;
    color: #6a7772;
    font-size: 8.5pt;
    text-align: center;
  }
  @media print {
    html, body { background: #ffffff; }
    body { max-width: none; }
    h1, h2, h3, th, .status { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }`

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function createSafeRenderer(): Renderer {
  const renderer = new Renderer()
  renderer.html = ({ text }) => escapeHtml(text)
  return renderer
}

function decorateStatusCells(html: string): string {
  const classes: Record<string, string> = {
    已提供: "status-ok",
    符合要求: "status-ok",
    不完整: "status-warning",
    技术问题: "status-warning",
    缺失: "status-critical",
    严重缺陷: "status-critical",
    致命缺陷: "status-critical",
    管理问题: "status-management",
  }

  return html.replace(/<td([^>]*)>(\s*)([^<]+?)(\s*)<\/td>/g, (cell, attributes, before, value, after) => {
    const label = value.trim()
    const statusClass = classes[label]
    if (!statusClass) return cell
    return `<td${attributes}>${before}<span class="status ${statusClass}">${label}</span>${after}</td>`
  })
}

function decorateTables(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (table, inner: string) => {
    const compactText = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, "")
    const isCompletenessTable = ["序号", "必审项", "核查结论", "问题等级", "方案对应内容"]
      .every((header) => compactText.includes(header))

    if (!isCompletenessTable) return table

    const normalizedHeader = inner.replace(
      /<th([^>]*)>\s*核查结论（已提供\/缺失\/不完整\/不适用）\s*<\/th>/,
      "<th$1>核查结论</th>"
    )
    return `<table class="completeness-table">${COMPLETENESS_COLUMNS}${normalizedHeader}</table>`
  })
}

export function renderReportMarkdown(markdown: string): string {
  const normalized = normalizeReviewMarkdown(markdown)
  const rendered = marked.parse(normalized, {
    async: false,
    breaks: false,
    gfm: true,
    renderer: createSafeRenderer(),
  }) as string

  return decorateStatusCells(decorateTables(rendered))
}

function buildReportDocument(markdown: string, wordCompatible: boolean, title = "审核报告"): string {
  const body = renderReportMarkdown(markdown)
  const namespaces = wordCompatible
    ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"'
    : ""

  return `<!DOCTYPE html>
<html${namespaces} lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  ${body}
  <p class="report-footer">本报告由重工施工方案 AI 智能审核系统生成，审核结果仅供专业复核使用。</p>
</body>
</html>`
}

export function buildPrintableReportHtml(markdown: string, title = "审核报告"): string {
  return buildReportDocument(markdown, false, title)
}

export function buildWordReportHtml(markdown: string, title = "审核报告"): string {
  return buildReportDocument(markdown, true, title)
}
