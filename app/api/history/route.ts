import { NextRequest, NextResponse } from "next/server"
import { deleteReviewRecordById, listReviewRecords } from "@/lib/storage/review-repository-factory"
import { getCurrentUserId } from "@/lib/supabase/server"

// 处理 CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

// GET - 获取历史记录列表
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get("page") || "1", 10)
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10)
    const professionType = searchParams.get("professionType") || undefined
    const keyword = searchParams.get("keyword") || undefined

    const { records, total } = await listReviewRecords(userId, page, pageSize, {
      professionType,
      keyword,
    })

    // 计算总页数
    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      success: true,
      data: {
        records,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
    })
  } catch (error) {
    console.error("获取历史记录失败:", error)
    return NextResponse.json(
      { error: "获取历史记录失败" },
      { status: 500 }
    )
  }
}

// DELETE - 删除历史记录
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get("id") || "0", 10)

    if (!id) {
      return NextResponse.json(
        { error: "请提供记录ID" },
        { status: 400 }
      )
    }

    await deleteReviewRecordById(userId, id)

    return NextResponse.json({
      success: true,
      message: "记录已删除",
    })
  } catch (error) {
    console.error("删除记录失败:", error)
    return NextResponse.json(
      { error: "删除记录失败" },
      { status: 500 }
    )
  }
}
