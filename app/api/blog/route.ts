import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

function isMissingBlogsTable(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || Boolean(error?.message?.includes("public.blogs"))
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("缺少 Supabase 环境变量:", { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey })
      return NextResponse.json({ success: false, error: "缺少 Supabase 配置" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      const { data, error } = await supabase
        .from("blogs")
        .select("*")
        .eq("id", id)
        .single()

      if (isMissingBlogsTable(error)) {
        return NextResponse.json({ success: false, error: "博客不存在" }, { status: 404 })
      }

      if (error || !data) {
        return NextResponse.json({ success: false, error: "博客不存在" }, { status: 404 })
      }

      return NextResponse.json({ success: true, data })
    }

    const { data, error } = await supabase
      .from("blogs")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      if (isMissingBlogsTable(error)) {
        return NextResponse.json({ success: true, data: [] })
      }

      console.error("博客查询错误:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("博客 API 错误:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
