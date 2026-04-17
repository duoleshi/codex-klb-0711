"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { History, ArrowUp, LogOut, LogIn, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { createClient } from "@/lib/supabase/client"

const navLinks = [
  { label: "功能", href: "/#features" },
  { label: "常见问题", href: "/#faq" },
  { label: "法规库", href: "/regulations" },
  { label: "测试", href: "/ocr-test" },
]

export function Header() {
  const router = useRouter()
  const [userPhone, setUserPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // 通过 onAuthStateChange 同时处理初始加载和后续变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserPhone(session.user.email.replace("@users.app", ""))
      } else {
        setUserPhone(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUserPhone(null)
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-4">

        {/* 左侧：Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="whitespace-nowrap font-semibold text-foreground">
            重工施工方案AI智能审核系统(自研)
          </span>
        </Link>

        {/* 中间：导航菜单（桌面端） */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* 右侧：动作 */}
        <div className="flex items-center gap-2">
          <Link href="/history">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">历史记录</span>
            </Button>
          </Link>
          <ThemeToggle />

          {!loading && userPhone ? (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
                <User className="h-3.5 w-3.5" />
                {userPhone}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">退出</span>
              </Button>
            </div>
          ) : !loading ? (
            <Link href="/login">
              <Button variant="outline" size="sm" className="gap-1.5">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">登录</span>
              </Button>
            </Link>
          ) : null}

          <a href="/#upload">
            <Button size="sm" className="gap-1.5">
              <ArrowUp className="h-4 w-4" />
              <span className="hidden sm:inline">开始审核</span>
            </Button>
          </a>
        </div>
      </div>
    </header>
  )
}
