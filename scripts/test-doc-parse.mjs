// 独立验证 .doc 解析：node scripts/test-doc-parse.mjs <文件路径>
// 用于确认 word-extractor 能正确读取老式 .doc 文件，无需走网页
import { readFileSync } from "node:fs"
import { argv } from "node:process"
import WordExtractor from "word-extractor"

const file = argv[2]
if (!file) {
  console.error("用法: node scripts/test-doc-parse.mjs <文件路径>")
  process.exit(1)
}

const buf = readFileSync(file)
console.log(`文件: ${file}`)
console.log(`大小: ${buf.length} bytes`)

// 魔数嗅探（与 lib/pdf-parser.ts 里 sniffOfficeFormat 一致）
if (buf.length >= 8 &&
    buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 &&
    buf[3] === 0xe0 && buf[4] === 0xa1 && buf[5] === 0xb1 &&
    buf[6] === 0x1a && buf[7] === 0xe1) {
  console.log("真实格式: OLE/CFBF（老式 .doc）→ 走 word-extractor ✓")
} else if (buf.length >= 4 &&
           buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
  console.log("真实格式: ZIP（OOXML/.docx）→ 这种应该走 mammoth，不是本脚本目的")
} else {
  console.log("真实格式: 未知！既不是 .doc 也不是 .docx")
}

const extractor = new WordExtractor()
try {
  const doc = await extractor.extract(buf)
  const body = doc.getBody ? doc.getBody() : ""
  console.log(`\n解析成功，正文字符数: ${body.length}`)
  console.log("--- 前 500 字预览 ---")
  console.log(body.slice(0, 500))
  console.log("--- 预览结束 ---")
} catch (e) {
  console.error("解析失败:", e)
  process.exit(1)
}
