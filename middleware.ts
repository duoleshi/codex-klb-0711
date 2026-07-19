import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

// 需要登录才能访问的页面
const protectedPaths = ["/history"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 静态资源和 API 路由不拦截
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/wasm") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // 创建 Supabase 服务端客户端来检查 session
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 检查用户是否已登录
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 检查是否是受保护的路径
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path))

  // 未登录用户访问受保护页面，重定向到登录页
  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|wasm|.*\\..*).*)",
  ],
}
