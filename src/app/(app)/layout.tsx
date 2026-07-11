import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/layout/app-shell"
import { countUnreadNotifications, listRecentNotifications } from "@/services/notifications"
import type { UserRole } from "@/types/domain"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // O middleware.ts já bloqueia usuário não logado antes de chegar aqui.
  // Esta checagem é defesa em profundidade (ex.: renderização de cache,
  // chamada direta ao Server Component em teste) — nunca a única barreira.
  const session = await getSessionUser()
  if (!session) {
    redirect("/login")
  }

  const supabase = await createClient()
  const [unreadCount, notifications] = await Promise.all([
    countUnreadNotifications(supabase, session.id),
    listRecentNotifications(supabase, session.id),
  ])

  return (
    <AppShell
      role={session.profile.role as UserRole}
      fullName={session.profile.full_name}
      isPlatformAdmin={session.profile.is_platform_admin}
      unreadNotifications={unreadCount}
      notifications={notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        relatedTable: n.relatedTable,
        relatedId: n.relatedId,
        isRead: n.isRead,
        createdAt: n.createdAt,
      }))}
    >
      {children}
    </AppShell>
  )
}
