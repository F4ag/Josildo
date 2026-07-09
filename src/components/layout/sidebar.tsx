"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { clsx } from "clsx"
import { NAV_ITEMS } from "./nav-items"
import { canAccessRoute } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => canAccessRoute(role, item.href))

  return (
    <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-black/5 bg-primary text-primary-foreground md:flex">
      <div className="px-6 py-5">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de public/, não precisa do otimizador do next/image */}
          <img src="/brand/icon-mark-inverted.svg" alt="" aria-hidden className="h-8 w-8 shrink-0" width={32} height={32} />
          <p className="text-lg font-semibold leading-tight">Lidera+</p>
        </div>
        <p className="mt-1 text-xs text-primary-foreground/70">
          Mais liderança. Mais presença. Mais resultado.
        </p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-white/10 font-medium text-white"
                  : "text-primary-foreground/80 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
