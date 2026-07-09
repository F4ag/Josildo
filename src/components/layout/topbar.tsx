"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Bell, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { USER_ROLE_LABELS, type UserRole } from "@/types/domain"
import { notificationHref } from "@/lib/notification-link"
import { markAllNotificationsReadAction, markNotificationReadAction } from "./notification-actions"

export type TopbarNotification = {
  id: string
  title: string
  message: string | null
  relatedTable: string | null
  relatedId: string | null
  isRead: boolean
  createdAt: string
}

type TopbarProps = {
  fullName: string
  role: UserRole
  unreadNotifications: number
  notifications: TopbarNotification[]
}

export function Topbar({ fullName, role, unreadNotifications, notifications }: TopbarProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)

  // Fecha o dropdown ao clicar fora — não existe um <dialog>/popover nativo
  // usado no resto do projeto, então isso é feito na mão com um listener.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  function handleItemClick(notification: TopbarNotification) {
    setOpen(false)
    if (notification.isRead) return
    startTransition(async () => {
      await markNotificationReadAction(notification.id)
      router.refresh()
    })
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction()
      router.refresh()
    })
  }

  return (
    <header className="no-print flex h-16 items-center justify-between border-b border-black/5 bg-white px-4 md:px-6">
      {/* Espaço reservado para breadcrumbs por página (Módulo "UI/UX" do prompt master). */}
      <div className="text-sm text-foreground/60" />

      <div className="flex items-center gap-4">
        <div ref={containerRef} className="relative">
          <button
            type="button"
            aria-label="Notificações"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="relative rounded-full p-2 text-foreground/70 hover:bg-black/5"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-black/10 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Notificações</p>
                {unreadNotifications > 0 && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleMarkAllRead}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-foreground/50">Nenhuma notificação.</p>
                )}
                {notifications.map((n) => {
                  const href = notificationHref(n.relatedTable, n.relatedId)
                  const body = (
                    <div className={`px-4 py-3 text-sm ${n.isRead ? "" : "bg-primary/5"}`}>
                      <div className="flex items-start gap-2">
                        {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{n.title}</p>
                          {n.message && <p className="mt-0.5 text-xs text-foreground/60">{n.message}</p>}
                          <p className="mt-1 text-[11px] text-foreground/40">
                            {new Date(n.createdAt).toLocaleString("pt-BR", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )

                  return href ? (
                    <Link
                      key={n.id}
                      href={href}
                      onClick={() => handleItemClick(n)}
                      className="block border-b border-black/5 last:border-0 hover:bg-black/[0.02]"
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className="block w-full border-b border-black/5 text-left last:border-0 hover:bg-black/[0.02]"
                    >
                      {body}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{fullName}</p>
          <p className="text-xs text-foreground/60">{USER_ROLE_LABELS[role]}</p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair"
          className="rounded-full p-2 text-foreground/70 hover:bg-black/5"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
