import { NextRequest, NextResponse } from "next/server"
import { getReviewRecord } from "@/lib/storage/review-repository-factory"
import { getCurrentUserId } from "@/lib/supabase/server"

// 处理 CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

// GET - 获取单条审核记录详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: "无效的记录ID" },
        { status: 400 }
      )
    }

    const record = await getReviewRecord(userId, id)

    if (!record) {
      return NextResponse.json(
        { error: "记录不存在" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: record,
    })
  } catch (error) {
    console.error("获取记录详情失败:", error)
    return NextResponse.json(
      { error: "获取记录详情失败" },
      { status: 500 }
    )
  }
}
