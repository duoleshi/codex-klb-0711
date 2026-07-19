import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

export async function POST(request: NextRequest) {
  try {
    const { phone: rawPhone, password } = await request.json()
    const phone = normalizePhone(String(rawPhone || ""))

    if (!phone || !password) {
      return NextResponse.json({ error: "请输入手机号和密码" }, { status: 400 })
    }

    if (!/^1\d{10}$/.test(phone)) {
      return NextResponse.json({ error: "请输入有效的手机号" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少需要6位" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data, error } = await supabase.auth.admin.createUser({
      email: `${phone}@users.app`,
      password,
      email_confirm: true,
      user_metadata: { phone },
    })

    if (error) {
      const msg = error.message || "注册失败"
      if (msg.includes("already been registered") || msg.includes("already registered")) {
        return NextResponse.json({ error: "该手机号已注册" }, { status: 400 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          phone,
          current_plan: "free",
          quota_remaining: 0,
          updated_at: new Date().toISOString(),
        })

      if (profileError) {
        console.error("创建用户资料失败:", profileError)
      }
    }

    return NextResponse.json({
      success: true,
      message: "注册成功",
    })
  } catch (error) {
    console.error("注册失败:", error)
    return NextResponse.json({ error: "注册失败，请重试" }, { status: 500 })
  }
}
