import { NextResponse } from "next/server"
import { PROFESSION_TYPES } from "@/lib/professions/profession-config"

// 给首页"选择专业领域"下拉动态渲染用（避免在 client 组件里 import knowledge-base，
// 那会把 fs 等 node 模块打进 client bundle）
export async function GET() {
  return NextResponse.json(
    PROFESSION_TYPES.map((p) => ({ id: p.id, name: p.name }))
  )
}
