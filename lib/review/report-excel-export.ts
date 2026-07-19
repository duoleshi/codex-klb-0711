import {
  Alignment,
  Borders,
  Cell,
  Fill,
  Font,
  Workbook,
  Worksheet,
} from "exceljs"
import { marked, type Token, type Tokens } from "marked"

import { normalizeReviewMarkdown } from "./report-markdown"

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const FONT_NAME = "Microsoft YaHei"
const LAST_COLUMN = 5

const COLORS = {
  darkGreen: "174C3C",
  titleGreen: "123F33",
  headingGreen: "173F35",
  lightGreen: "EAF2EF",
  paleGreen: "F4F8F6",
  text: "17202A",
  muted: "6A7772",
  border: "B8C7C1",
  white: "FFFFFF",
}

const TABLE_BORDER: Partial<Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
}

const BODY_FONT: Partial<Font> = {
  name: FONT_NAME,
  size: 10.5,
  color: { argb: COLORS.text },
}

function plainText(token: Token | Tokens.TableCell): string {
  if ("tokens" in token && Array.isArray(token.tokens) && token.tokens.length > 0) {
    return token.tokens.map(plainText).join("")
  }
  if ("text" in token && typeof token.text === "string") return token.text
  return ""
}

function mergedCell(worksheet: Worksheet, rowNumber: number): Cell {
  worksheet.mergeCells(rowNumber, 1, rowNumber, LAST_COLUMN)
  return worksheet.getCell(rowNumber, 1)
}

function estimateRowHeight(text: string, charsPerLine = 100): number {
  const explicitLines = text.split("\n")
  const wrappedLines = explicitLines.reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)),
    0
  )
  return Math.min(120, Math.max(21, wrappedLines * 17))
}

function addSpacer(worksheet: Worksheet, height = 7): void {
  const row = worksheet.addRow([])
  row.height = height
}

function addMergedText(
  worksheet: Worksheet,
  text: string,
  options: {
    font?: Partial<Font>
    fill?: Fill
    alignment?: Partial<Alignment>
    height?: number
    indent?: number
  } = {}
): void {
  const row = worksheet.addRow([])
  const cell = mergedCell(worksheet, row.number)
  cell.value = text
  cell.font = { ...BODY_FONT, ...options.font }
  if (options.fill) cell.fill = options.fill
  cell.alignment = {
    vertical: "top",
    horizontal: "left",
    wrapText: true,
    indent: options.indent,
    ...options.alignment,
  }
  row.height = options.height ?? estimateRowHeight(text)
}

function headingFill(color: string): Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: color } }
}

function addHeading(worksheet: Worksheet, token: Tokens.Heading): void {
  const text = plainText(token).trim()
  if (!text) return

  if (token.depth === 1) {
    addMergedText(worksheet, text, {
      font: { name: FONT_NAME, size: 18, bold: true, color: { argb: COLORS.white } },
      fill: headingFill(COLORS.darkGreen),
      alignment: { horizontal: "center", vertical: "middle" },
      height: 38,
    })
    addSpacer(worksheet, 9)
    return
  }

  if (token.depth === 2) {
    addSpacer(worksheet, 7)
    addMergedText(worksheet, text, {
      font: { name: FONT_NAME, size: 13.5, bold: true, color: { argb: COLORS.headingGreen } },
      fill: headingFill(COLORS.lightGreen),
      alignment: { vertical: "middle" },
      height: 28,
    })
    return
  }

  addMergedText(worksheet, text, {
    font: { name: FONT_NAME, size: 11.5, bold: true, color: { argb: COLORS.titleGreen } },
    fill: headingFill(COLORS.paleGreen),
    alignment: { vertical: "middle" },
    height: 24,
  })
}

function listItemText(item: Tokens.ListItem): string {
  return item.tokens
    .filter((token) => token.type !== "list")
    .map(plainText)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

function addList(worksheet: Worksheet, token: Tokens.List, level = 0): void {
  token.items.forEach((item, index) => {
    const text = listItemText(item)
    if (text) {
      const marker = token.ordered ? `${Number(token.start ?? 1) + index}.` : "•"
      addMergedText(worksheet, `${marker} ${text}`, {
        indent: Math.min(level + 1, 4),
        height: estimateRowHeight(text, 48),
      })
    }

    item.tokens.forEach((child) => {
      if (child.type === "list") addList(worksheet, child as Tokens.List, level + 1)
    })
  })
}

function statusStyle(label: string): { fill: Fill; color: string } | undefined {
  const compact = label.replace(/\s+/g, "")
  if (["已提供", "符合要求"].includes(compact)) {
    return { fill: headingFill("EDF9F3"), color: "176745" }
  }
  if (["不完整", "技术问题"].includes(compact)) {
    return { fill: headingFill("FFF8E5"), color: "8A5700" }
  }
  if (["缺失", "严重缺陷", "致命缺陷"].includes(compact)) {
    return { fill: headingFill("FFF0F0"), color: "A32121" }
  }
  if (compact === "管理问题") {
    return { fill: headingFill("EFF7FD"), color: "155B8F" }
  }
  return undefined
}

function styleTableCell(cell: Cell, header: boolean, centered: boolean): void {
  cell.border = TABLE_BORDER
  cell.font = {
    ...BODY_FONT,
    bold: header,
    color: { argb: header ? COLORS.titleGreen : COLORS.text },
  }
  cell.fill = headingFill(header ? COLORS.lightGreen : COLORS.white)
  cell.alignment = {
    horizontal: centered ? "center" : "left",
    vertical: header ? "middle" : "top",
    wrapText: true,
  }
}

function addTable(worksheet: Worksheet, token: Tokens.Table): void {
  const headerValues = token.header.map((cell) => {
    const text = plainText(cell).trim()
    return text.startsWith("核查结论（") ? "核查结论" : text
  })
  const isCompleteness = ["序号", "必审项", "核查结论", "问题等级", "方案对应内容"]
    .every((header) => headerValues.includes(header))
  const columnCount = Math.min(token.header.length, LAST_COLUMN)

  const headerRow = worksheet.addRow(headerValues.slice(0, columnCount))
  headerRow.height = 26
  for (let column = 1; column <= columnCount; column++) {
    styleTableCell(headerRow.getCell(column), true, true)
  }

  token.rows.forEach((tableRow) => {
    const values = tableRow.slice(0, columnCount).map((cell) => plainText(cell).trim())
    const row = worksheet.addRow(values)
    const evidence = values[isCompleteness ? 4 : values.length - 1] ?? ""
    row.height = estimateRowHeight(evidence, 48)

    for (let column = 1; column <= columnCount; column++) {
      const cell = row.getCell(column)
      styleTableCell(cell, false, isCompleteness && [1, 3, 4].includes(column))
      const status = statusStyle(String(cell.value ?? ""))
      if (status) {
        cell.fill = status.fill
        cell.font = { ...BODY_FONT, bold: true, color: { argb: status.color } }
      }
    }
  })

  addSpacer(worksheet, 9)
}

function addBlocks(worksheet: Worksheet, tokens: Token[]): void {
  for (const token of tokens) {
    if (token.type === "space") continue
    if (token.type === "heading") {
      addHeading(worksheet, token as Tokens.Heading)
      continue
    }
    if (token.type === "paragraph" || token.type === "text") {
      const text = plainText(token).replace(/\s+\n/g, "\n").trim()
      if (text) addMergedText(worksheet, text)
      continue
    }
    if (token.type === "list") {
      addList(worksheet, token as Tokens.List)
      continue
    }
    if (token.type === "table") {
      addTable(worksheet, token as Tokens.Table)
      continue
    }
    if (token.type === "blockquote") {
      const text = (token as Tokens.Blockquote).tokens.map(plainText).join(" ").trim()
      if (text) {
        addMergedText(worksheet, text, {
          fill: headingFill(COLORS.paleGreen),
          font: { ...BODY_FONT, italic: true, color: { argb: "40534D" } },
        })
      }
      continue
    }
    if (token.type === "code") {
      addMergedText(worksheet, (token as Tokens.Code).text, {
        fill: headingFill("F1F4F3"),
        font: { name: "Consolas", size: 9.5, color: { argb: "33413C" } },
      })
      continue
    }
    if (token.type === "hr") addSpacer(worksheet, 8)
  }
}

function createWorkbook(markdown: string): Workbook {
  const workbook = new Workbook()
  workbook.creator = "重工施工方案 AI 智能审核系统"
  workbook.title = "施工方案审核报告"
  workbook.subject = "危大工程专项施工方案智能审核"
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet("审核报告", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    properties: { defaultRowHeight: 21 },
  })

  worksheet.columns = [
    { key: "sequence", width: 8 },
    { key: "item", width: 26 },
    { key: "conclusion", width: 16 },
    { key: "level", width: 16 },
    { key: "evidence", width: 62 },
  ]

  const tokens = marked.lexer(normalizeReviewMarkdown(markdown), { gfm: true })
  addBlocks(worksheet, tokens)
  addSpacer(worksheet, 10)
  addMergedText(worksheet, "本报告由重工施工方案 AI 智能审核系统生成，审核结果仅供专业复核使用。", {
    font: { name: FONT_NAME, size: 9, color: { argb: COLORS.muted } },
    alignment: { horizontal: "center", vertical: "middle" },
    height: 22,
  })
  worksheet.pageSetup.printArea = `A1:E${worksheet.rowCount}`

  return workbook
}

export async function buildExcelReportBlob(markdown: string): Promise<Blob> {
  const workbook = createWorkbook(markdown)
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([new Uint8Array(buffer)], { type: XLSX_MIME })
}
