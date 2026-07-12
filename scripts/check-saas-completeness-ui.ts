// scripts/check-saas-completeness-ui.ts
// 验证完整性核查表已产品化为 SaaS 组件，并提供定价页入口。
// 运行：npx tsx scripts/check-saas-completeness-ui.ts

import fs from "fs"
import path from "path"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✅ ${message}`)
  }
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main() {
  const reviewResult = read("components/review-result.tsx")
  assert(reviewResult.includes("CompletenessAuditPanel"), "审核结果组件包含完整性 SaaS 面板")
  assert(reviewResult.includes("parseCompletenessAuditTable"), "完整性表格有结构化解析逻辑")
  assert(reviewResult.includes("完整性必审项核查"), "完整性面板显示完整性必审项核查标题")
  assert(reviewResult.includes("已提供") && reviewResult.includes("不完整") && reviewResult.includes("缺失"), "完整性面板统计核查结论")
  assert(reviewResult.includes("致命缺陷") && reviewResult.includes("管理问题"), "完整性面板统计问题等级")
  assert(reviewResult.includes("展开详情") && reviewResult.includes("收起详情"), "完整性面板支持展开/收起")
  assert(reviewResult.includes("handleDownloadPDF") && reviewResult.includes("handleDownloadExcel") && reviewResult.includes("handleDownloadWord"), "审核结果顶部提供整份报告 PDF/Excel/Word 导出")
  assert(!reviewResult.includes("exportTableAsPDF") && !reviewResult.includes("完整性核查表.xls"), "完整性局部表格不再提供单独导出")
  assert(reviewResult.includes("问题等级") && reviewResult.includes("方案对应内容"), "完整性表格固定包含问题等级和方案对应内容")
  assert(reviewResult.includes("nth-child(4)]:w-[12%]") && reviewResult.includes("nth-child(5)]:w-[45%]"), "完整性表格将问题等级设为短列、方案对应内容设为主列")
  assert(reviewResult.includes("findHeaderIndex") && reviewResult.includes("header.startsWith(`${name}（`)"), "完整性表格可识别带说明文字的长表头")
  assert(reviewResult.includes("text.startsWith(\"核查结论\") ? \"核查结论\""), "普通 Markdown 表格会压缩核查结论长表头")

  const hasPricingPage = fs.existsSync(path.join(process.cwd(), "app/pricing/page.tsx"))
  assert(hasPricingPage, "存在定价页 app/pricing/page.tsx")
  const pricingPage = hasPricingPage ? read("app/pricing/page.tsx") : ""
  assert(pricingPage.includes("Plus") && pricingPage.includes("20元/月"), "定价页包含 Plus 20元/月")
  assert(pricingPage.includes("Pro") && pricingPage.includes("50元/月"), "定价页包含 Pro 50元/月")
  assert(pricingPage.includes("Ultra") && pricingPage.includes("100元/月"), "定价页包含 Ultra 100元/月")

  const header = read("components/landing/header.tsx")
  assert(header.includes("/pricing"), "导航栏包含定价页入口")

  if (process.exitCode) {
    console.error("\n❌ SaaS 完整性界面检查未通过")
    process.exit(process.exitCode)
  }

  console.log("\n✅ SaaS 完整性界面检查通过")
}

main()
