"use client"

// Menu de navegação para telas pequenas (< md). O Sidebar (sidebar.tsx) fica
// com "hidden md:flex" — ou seja, é INVISÍVEL no celular, e até agora não
// existia nenhum substituto: no celular a pessoa não tinha como abrir
// Mapa Territorial, Aniversariantes, Relatórios, Agenda, Mensagens nem
// Configurações (só chegava a outras telas por um link direto, ex.: uma
// notificação). Este componente resolve isso com um menu hambúrguer que
// abre uma gaveta lateral com a mesma lista de NAV_ITEMS do Sidebar
// (incluindo o mesmo filtro de permissão por role), mais a logomarca no
// topo — clicar nela também leva pro Dashboard (nossa "home").

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { clsx } from "clsx"
import { Menu, X } from "lucide-react"
import { NAV_ITEMS } from "./nav-items"
import { canAccessRoute } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"

export function MobileNav({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => canAccessRoute(role, item.href))

  // Fecha a gaveta sozinha se a pessoa navegar por outro meio (ex.: botão
  // "voltar" do celular) enquanto ela estava aberta.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={open}
        className="rounded-md p-2 text-foreground/70 hover:bg-black/5 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- backdrop só fecha o menu, não é um controle de teclado */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />

          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-primary text-primary-foreground shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de public/, não precisa do otimizador do next/image */}
                <img src="/brand/icon-mark-inverted.svg" alt="" aria-hidden className="h-8 w-8 shrink-0" width={32} height={32} />
                <p className="text-lg font-semibold leading-tight">Lidera+</p>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="rounded-md p-1.5 text-primary-foreground/80 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
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
          </div>
        </div>
      )}
    </>
  )
}
