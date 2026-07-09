"use client"

import { useState } from "react"
import { clsx } from "clsx"

type Tab = { label: string; content: React.ReactNode; badge?: number }

/**
 * Tabs simples e client-only. O conteúdo de cada aba pode ter sido
 * renderizado por um Server Component "por cima" — passar JSX já resolvido
 * como prop para um Client Component é suportado pelo React Server
 * Components (a árvore não vira client, só o controle de qual aba mostrar).
 */
export function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0)

  return (
    <div>
      <div className="flex gap-1 border-b border-black/10">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(i)}
            className={clsx(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active === i
                ? "border-primary text-primary"
                : "border-transparent text-foreground/60 hover:text-foreground",
            )}
          >
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.5 text-xs">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>
      <div className="pt-4">{tabs[active]?.content}</div>
    </div>
  )
}
