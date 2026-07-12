"use client"

import Link from "next/link"
import Image from "next/image"

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/30 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Logo"
              width={28}
              height={28}
              className="h-7 w-7 rounded object-contain"
            />
            <span className="text-sm font-medium text-foreground">
              重工施工方案AI智能审核系统(自研)
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/history"
              className="transition-colors hover:text-foreground"
            >
              历史记录
            </Link>
            <Link
              href="/regulations"
              className="transition-colors hover:text-foreground"
            >
              法规库
            </Link>
            <Link
              href="/pricing"
              className="transition-colors hover:text-foreground"
            >
              价格
            </Link>
          </div>

          {/* Copyright */}
          <div className="text-sm text-muted-foreground">
            <span>基于 DeepSeek AI 技术</span>
            <span className="mx-2">·</span>
            <span>审核结果仅供参考</span>
          </div>

          {/* QR Code with hover effect */}
          <div className="group relative flex flex-col items-center gap-1 cursor-pointer">
            <Image
              src="/logo.png"
              alt="关注重工"
              width={28}
              height={28}
              className="rounded object-contain transition-transform group-hover:scale-110"
            />
            <span className="text-xs text-muted-foreground">关注重工</span>
            {/* Hover popup */}
            <div className="absolute bottom-full right-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-white dark:bg-card p-3 rounded-lg shadow-xl border border-border">
                <div
                  className="w-[130px] h-[130px] rounded bg-contain bg-no-repeat bg-center"
                  style={{ backgroundImage: 'url(/qrcode.png?v=8)' }}
                  title="关注重工"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
