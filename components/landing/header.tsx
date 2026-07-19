"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { History, ArrowUp, LogOut, LogIn, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/theme-toggle"
import { createClient } from "@/lib/supabase/client"

const navLinks = [
  { label: "功能", href: "/#features" },
  { label: "价格", href: "/pricing" },
  { label: "常见问题", href: "/#faq" },
  { label: "法规库", href: "/regulations" },
  { label: "测试", href: "/ocr-test" },
]

function getPhoneFromEmail(email?: string): string | null {
  if (!email?.endsWith("@users.app")) return null
  return email.replace("@users.app", "")
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

export function Header() {
  const router = useRouter()
  const [userPhone, setUserPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // 通过 onAuthStateChange 同时处理初始加载和后续变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserPhone(getPhoneFromEmail(session?.user?.email))
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
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">

        {/* 左侧：Logo */}
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
          <Image
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="hidden whitespace-nowrap font-semibold text-foreground lg:inline">
            重工施工方案AI智能审核系统(自研)
          </span>
        </Link>

        {/* 中间：导航菜单（桌面端） */}
        <nav className="hidden flex-1 justify-center gap-1 xl:flex">
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
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href="/history">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <History className="h-4 w-4" />
              <span className="hidden lg:inline">历史记录</span>
            </Button>
          </Link>
          <ThemeToggle />

          {!loading && userPhone ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="用户菜单">
                      <Avatar className="size-8 border">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <UserCircle className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">{maskPhone(userPhone)}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">当前账号</span>
                    <span className="text-xs font-normal text-muted-foreground">{maskPhone(userPhone)}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} variant="destructive">
                  <LogOut className="h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
