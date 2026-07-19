import {
  AlignmentType,
  BorderStyle,
  Document as WordDocument,
  LevelFormat,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx"
import { marked, type Token, type Tokens } from "marked"

import { normalizeReviewMarkdown } from "./report-markdown"

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const CONTENT_WIDTH = 10432
const COMPLETENESS_WIDTHS = [626, 2608, 1252, 1252, 4694]
const FONT_NAME = "Microsoft YaHei"

const TABLE_BORDER = {
  color: "B8C7C1",
  size: 4,
  style: BorderStyle.SINGLE,
}

interface RunStyle {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  color?: string
  underline?: boolean
  font?: string
}

function tokenPlainText(token: Token | Tokens.TableCell): string {
  if ("text" in token && typeof token.text === "string") return token.text
  if ("tokens" in token && Array.isArray(token.tokens)) {
    return token.tokens.map(tokenPlainText).join("")
  }
  return ""
}

function inlineRuns(tokens: Token[] = [], inherited: RunStyle = {}): TextRun[] {
  const runs: TextRun[] = []

  for (const token of tokens) {
    if (token.type === "strong") {
      runs.push(...inlineRuns((token as Tokens.Strong).tokens, { ...inherited, bold: true }))
      continue
    }
    if (token.type === "em") {
      runs.push(...inlineRuns((token as Tokens.Em).tokens, { ...inherited, italics: true }))
      continue
    }
    if (token.type === "del") {
      runs.push(...inlineRuns((token as Tokens.Del).tokens, { ...inherited, strike: true }))
      continue
    }
    if (token.type === "link") {
      runs.push(...inlineRuns((token as Tokens.Link).tokens, {
        ...inherited,
        color: "155B8F",
        underline: true,
      }))
      continue
    }
    if (token.type === "codespan") {
      runs.push(new TextRun({
        text: (token as Tokens.Codespan).text,
        font: "Consolas",
        color: "33413C",
        size: 19,
      }))
      continue
    }
    if (token.type === "br") {
      runs.push(new TextRun({ break: 1 }))
      continue
    }

    const nested = "tokens" in token && Array.isArray(token.tokens) ? token.tokens : undefined
    if (nested?.length) {
      runs.push(...inlineRuns(nested, inherited))
      continue
    }

    const text = tokenPlainText(token)
    if (!text) continue
    runs.push(new TextRun({
      text,
      bold: inherited.bold,
      italics: inherited.italics,
      strike: inherited.strike,
      color: inherited.color,
      font: inherited.font ?? FONT_NAME,
      underline: inherited.underline ? { type: UnderlineType.SINGLE } : undefined,
      size: 21,
    }))
  }

  return runs
}

function runsFromBlockToken(token: Token): TextRun[] {
  if ("tokens" in token && Array.isArray(token.tokens)) return inlineRuns(token.tokens)
  const text = tokenPlainText(token)
  return text ? [new TextRun({ text, font: FONT_NAME, size: 21 })] : []
}

function bodyParagraph(children: TextRun[], options: { alignment?: typeof AlignmentType[keyof typeof AlignmentType]; indent?: number } = {}): Paragraph {
  return new Paragraph({
    children,
    alignment: options.alignment,
    indent: options.indent ? { left: options.indent } : undefined,
    spacing: { before: 30, after: 90, line: 330 },
    widowControl: true,
  })
}

function statusColors(label: string): { fill?: string; color?: string } {
  const compact = label.replace(/\s+/g, "")
  if (["已提供", "符合要求"].includes(compact)) return { fill: "EDF9F3", color: "176745" }
  if (["不完整", "技术问题"].includes(compact)) return { fill: "FFF8E5", color: "8A5700" }
  if (["缺失", "严重缺陷", "致命缺陷"].includes(compact)) return { fill: "FFF0F0", color: "A32121" }
  if (compact === "管理问题") return { fill: "EFF7FD", color: "155B8F" }
  return {}
}

function tableCell(
  cell: Tokens.TableCell,
  width: number,
  columnIndex: number,
  header: boolean
): TableCell {
  const rawText = tokenPlainText(cell).trim()
  const displayText = header && rawText.startsWith("核查结论（") ? "核查结论" : rawText
  const status = header ? {} : statusColors(displayText)
  const centered = header || [0, 2, 3].includes(columnIndex)
  const children = displayText === rawText
    ? inlineRuns(cell.tokens, { bold: header, color: status.color })
    : [new TextRun({ text: displayText, bold: true, color: "183E33", font: FONT_NAME, size: 20 })]

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: centered ? VerticalAlign.CENTER : VerticalAlign.TOP,
    shading: {
      fill: header ? "EAF2EF" : status.fill ?? "FFFFFF",
      type: ShadingType.CLEAR,
    },
    borders: {
      top: TABLE_BORDER,
      bottom: TABLE_BORDER,
      left: TABLE_BORDER,
      right: TABLE_BORDER,
    },
    children: [new Paragraph({
      children,
      alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 70, after: 70, line: 300 },
    })],
  })
}

function tableFromToken(token: Tokens.Table): Table {
  const headerText = token.header.map((cell) => tokenPlainText(cell).replace(/\s+/g, ""))
  const completenessHeaders = ["序号", "必审项", "核查结论", "问题等级", "方案对应内容"]
  const isCompleteness = completenessHeaders.every((header) =>
    headerText.some((value) => value.includes(header))
  )
  const columnCount = Math.max(token.header.length, 1)
  const equalWidth = Math.floor(CONTENT_WIDTH / columnCount)
  const widths = isCompleteness
    ? COMPLETENESS_WIDTHS
    : Array.from({ length: columnCount }, (_, index) =>
        index === columnCount - 1 ? CONTENT_WIDTH - equalWidth * (columnCount - 1) : equalWidth
      )

  const rows = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: token.header.map((cell, index) => tableCell(cell, widths[index], index, true)),
    }),
    ...token.rows.map((row) => new TableRow({
      cantSplit: true,
      children: row.map((cell, index) => tableCell(cell, widths[index] ?? equalWidth, index, false)),
    })),
  ]

  return new Table({
    rows,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: {
      top: TABLE_BORDER,
      bottom: TABLE_BORDER,
      left: TABLE_BORDER,
      right: TABLE_BORDER,
      insideHorizontal: TABLE_BORDER,
      insideVertical: TABLE_BORDER,
    },
  })
}

function listItemRuns(item: Tokens.ListItem): TextRun[] {
  const runs: TextRun[] = []
  for (const token of item.tokens) {
    if (token.type === "list") continue
    if (runs.length > 0) runs.push(new TextRun({ break: 1 }))
    runs.push(...runsFromBlockToken(token))
  }
  return runs
}

function listChildren(token: Tokens.List, level = 0): Paragraph[] {
  const paragraphs: Paragraph[] = []

  for (const item of token.items) {
    paragraphs.push(new Paragraph({
      children: listItemRuns(item),
      ...(token.ordered
        ? { numbering: { reference: "review-numbering", level: Math.min(level, 4) } }
        : { bullet: { level: Math.min(level, 4) } }),
      spacing: { before: 20, after: 65, line: 320 },
      widowControl: true,
    }))

    for (const child of item.tokens) {
      if (child.type === "list") paragraphs.push(...listChildren(child as Tokens.List, level + 1))
    }
  }

  return paragraphs
}

function blockChildren(tokens: Token[]): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = []

  for (const token of tokens) {
    if (token.type === "space") continue
    if (token.type === "heading") {
      const heading = token as Tokens.Heading
      const style = heading.depth === 1
        ? "ReviewTitle"
        : heading.depth === 2
          ? "ReviewSectionHeading"
          : "ReviewIssueHeading"
      children.push(new Paragraph({ style, children: inlineRuns(heading.tokens, { bold: true }) }))
      continue
    }
    if (token.type === "paragraph" || token.type === "text") {
      children.push(bodyParagraph(runsFromBlockToken(token)))
      continue
    }
    if (token.type === "list") {
      children.push(...listChildren(token as Tokens.List))
      continue
    }
    if (token.type === "table") {
      children.push(tableFromToken(token as Tokens.Table))
      children.push(new Paragraph({ spacing: { after: 80 } }))
      continue
    }
    if (token.type === "blockquote") {
      const quote = token as Tokens.Blockquote
      const text = quote.tokens.map(tokenPlainText).join(" ")
      children.push(new Paragraph({
        children: [new TextRun({ text, color: "40534D", italics: true, font: FONT_NAME, size: 20 })],
        indent: { left: 360 },
        shading: { fill: "F4F8F6", type: ShadingType.CLEAR },
        border: { left: { color: "8AA89F", style: BorderStyle.SINGLE, size: 12, space: 8 } },
        spacing: { before: 80, after: 100, line: 320 },
      }))
      continue
    }
    if (token.type === "hr") {
      children.push(new Paragraph({
        border: { bottom: { color: "D8DFDC", style: BorderStyle.SINGLE, size: 4, space: 6 } },
        spacing: { before: 80, after: 100 },
      }))
      continue
    }
    if (token.type === "code") {
      children.push(new Paragraph({
        children: [new TextRun({ text: (token as Tokens.Code).text, font: "Consolas", size: 18 })],
        shading: { fill: "F1F4F3", type: ShadingType.CLEAR },
        spacing: { before: 70, after: 90, line: 300 },
      }))
      continue
    }
  }

  return children
}

function createWordDocument(markdown: string): WordDocument {
  const normalized = normalizeReviewMarkdown(markdown)
  const tokens = marked.lexer(normalized, { gfm: true })

  return new WordDocument({
    creator: "重工施工方案 AI 智能审核系统",
    title: "施工方案审核报告",
    description: "危大工程专项施工方案智能审核报告",
    styles: {
      default: {
        document: {
          run: { font: FONT_NAME, size: 21, color: "17202A" },
          paragraph: { spacing: { after: 90, line: 330 } },
        },
      },
      paragraphStyles: [
        {
          id: "ReviewTitle",
          name: "Review Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT_NAME, size: 36, bold: true, color: "123F33" },
          paragraph: {
            alignment: AlignmentType.CENTER,
            keepNext: true,
            spacing: { before: 0, after: 260 },
            border: { bottom: { color: "174C3C", style: BorderStyle.SINGLE, size: 12, space: 8 } },
            outlineLevel: 0,
          },
        },
        {
          id: "ReviewSectionHeading",
          name: "Review Section Heading",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT_NAME, size: 29, bold: true, color: "173F35" },
          paragraph: {
            keepNext: true,
            spacing: { before: 300, after: 130 },
            border: { left: { color: "174C3C", style: BorderStyle.SINGLE, size: 16, space: 8 } },
            outlineLevel: 1,
          },
        },
        {
          id: "ReviewIssueHeading",
          name: "Review Issue Heading",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT_NAME, size: 23, bold: true, color: "22352F" },
          paragraph: { keepNext: true, spacing: { before: 210, after: 90 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [{
        reference: "review-numbering",
        levels: Array.from({ length: 5 }, (_, level) => ({
          level,
          format: LevelFormat.DECIMAL,
          text: `%${level + 1}.`,
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: 720 + level * 360, hanging: 360 },
            },
          },
        })),
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 794, right: 737, bottom: 907, left: 737, header: 360, footer: 360 },
        },
      },
      children: [
        ...blockChildren(tokens),
        new Paragraph({
          children: [new TextRun({
            text: "本报告由重工施工方案 AI 智能审核系统生成，审核结果仅供专业复核使用。",
            color: "6A7772",
            size: 17,
            font: FONT_NAME,
          })],
          alignment: AlignmentType.CENTER,
          border: { top: { color: "D8DFDC", style: BorderStyle.SINGLE, size: 4, space: 8 } },
          spacing: { before: 220, after: 0 },
        }),
      ],
    }],
  })
}

export async function buildWordReportBlob(markdown: string): Promise<Blob> {
  const blob = await Packer.toBlob(createWordDocument(markdown))
  return new Blob([blob], { type: DOCX_MIME })
}
