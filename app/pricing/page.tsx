import Link from "next/link"
import { ArrowRight, Check, Crown, FileSpreadsheet, ShieldCheck, Sparkles } from "lucide-react"
import { Header } from "@/components/landing/header"
import { Footer } from "@/components/landing/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const plans = [
  {
    name: "Plus",
    price: "20元/月",
    description: "适合个人工程师和小团队试用完整性核查能力。",
    icon: ShieldCheck,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    features: [
      "完整性核查 12 项必审",
      "致命缺陷优先识别",
      "表格化审核报告",
      "基础历史记录",
    ],
  },
  {
    name: "Pro",
    price: "50元/月",
    description: "适合施工单位、监理单位日常方案预审。",
    icon: FileSpreadsheet,
    tone: "border-primary/30 bg-primary/10 text-primary",
    featured: true,
    features: [
      "Plus 全部能力",
      "技术问题与管理问题审核",
      "规范依据与整改建议",
      "PDF / Excel / Word 导出",
      "四类以上专业方案连续审核",
    ],
  },
  {
    name: "Ultra",
    price: "100元/月",
    description: "适合企业级项目部沉淀审核数据和案例资产。",
    icon: Crown,
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    features: [
      "Pro 全部能力",
      "多项目历史对比",
      "整改前后对比报告",
      "企业案例材料沉淀",
      "优先扩展专业弹药库",
    ],
  },
]

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="border-b bg-muted/20 py-14 md:py-18">
          <div className="mx-auto max-w-6xl px-4">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-4 rounded-sm bg-background">
                SaaS 定价
              </Badge>
              <h1 className="text-3xl font-semibold tracking-normal text-foreground md:text-5xl">
                施工方案 AI 智能审核
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                用完整性核查表、精准规范锚点和分层审核报告，把方案预审从经验判断变成可量化、可追踪的标准流程。
              </p>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-14">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon
              return (
                <Card
                  key={plan.name}
                  className={`relative overflow-hidden ${plan.featured ? "border-primary shadow-md" : ""}`}
                >
                  {plan.featured && (
                    <div className="absolute right-4 top-4">
                      <Badge className="rounded-sm">推荐</Badge>
                    </div>
                  )}
                  <CardHeader className="space-y-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${plan.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      <div className="mt-3 flex items-end gap-2">
                        <span className="text-3xl font-semibold tracking-normal">{plan.price}</span>
                      </div>
                      <p className="mt-3 min-h-[52px] text-sm leading-6 text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/#upload">
                      <Button className="mt-6 w-full gap-2" variant={plan.featured ? "default" : "outline"}>
                        开始试用
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="pb-14">
          <div className="mx-auto max-w-6xl px-4">
            <div className="rounded-lg border bg-muted/20 p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    表格化审核是核心能力
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    免费试用优先展示完整性核查结论；专业版开放完整整改建议、规范依据和导出能力；企业版面向多项目历史对比和案例沉淀。
                  </p>
                </div>
                <Link href="/#upload">
                  <Button variant="outline" className="gap-2">
                    上传方案
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
