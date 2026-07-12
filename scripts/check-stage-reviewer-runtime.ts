// scripts/check-stage-reviewer-runtime.ts
// 用 fake LLM 客户端验证完整性/技术/合并三阶段在运行时可调用。
// 运行：npx tsx scripts/check-stage-reviewer-runtime.ts

import type OpenAI from "openai"
import { getAllClauses } from "../lib/clauses/clause-search"
import {
  mergeStageReports,
  runCompletenessReviewStage,
  runTechnicalReviewStage,
} from "../lib/review/stage-reviewer"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✅ ${message}`)
  }
}

async function main() {
  const prompts: string[] = []
  const fakeClient = {
    chat: {
      completions: {
        create: async (input: { messages: { content: string }[] }) => {
          const prompt = input.messages.at(-1)?.content ?? ""
          prompts.push(prompt)
          const content = prompt.includes("合并为最终施工方案审核报告")
            ? "最终报告：## 3. 完整性必审项核查\n\n保留完整性缺失，并补充技术问题。"
            : prompt.includes("第二阶段技术细节审核")
              ? "技术阶段报告：盘扣式立杆规格需复核。"
              : "完整性阶段报告：缺少施工总平面布置图、相关施工图纸、施工设计计算书。"
          return {
            choices: [{ message: { content } }],
            usage: { total_tokens: 100 },
          }
        },
      },
    },
  } as unknown as OpenAI

  const clauses = (await getAllClauses())
    .filter((c) => c.profession === "general" || c.profession === "template")
    .slice(0, 20)
    .map((c) => ({ ...c, matchedBy: ["运行检查"] }))
  const common = {
    client: fakeClient,
    modelName: "fake-model",
    maxOutputTokens: 1000,
    filename: "清华附中高大模板.pdf",
    professionNames: "模板支撑体系工程",
    currentDate: "2026年7月11日",
    anchorClauses: clauses,
    documentContent: "本方案为高大模板专项施工方案，采用盘扣式支撑架。",
  }

  const completeness = await runCompletenessReviewStage(common)
  const technical = await runTechnicalReviewStage({ ...common, completenessReport: completeness.report })
  const merged = await mergeStageReports({
    ...common,
    completenessReport: completeness.report,
    technicalReport: technical.report,
  })

  assert(prompts.length === 3, "运行时发起完整性、技术、合并三次阶段调用")
  assert(prompts[0].includes("完整性审核清单"), "第一阶段 prompt 包含完整性审核清单")
  assert(prompts[1].includes("第一阶段完整性审核结果"), "第二阶段 prompt 带入完整性阶段结果")
  assert(prompts[2].includes("完整性阶段审核报告（优先保留，缺项不得遗漏）"), "合并阶段 prompt 优先保留完整性报告")
  assert(completeness.tokensUsed + technical.tokensUsed + merged.tokensUsed === 300, "阶段 token 用量可累计")
  assert(merged.report.includes("## 3. 完整性必审项核查"), "最终合并结果保留完整性章节")

  if (process.exitCode) {
    console.error("\n❌ 阶段审核运行检查未通过")
    process.exit(process.exitCode)
  }

  console.log("\n✅ 阶段审核运行检查通过")
}

main().catch((error) => {
  console.error("检查失败:", error)
  process.exit(1)
})
