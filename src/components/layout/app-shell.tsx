import { Sidebar } from "./sidebar"
import { Topbar, type TopbarNotification } from "./topbar"
import type { UserRole } from "@/types/domain"

type AppShellProps = {
  role: UserRole
  fullName: string
  unreadNotifications: number
  notifications: TopbarNotification[]
  isPlatformAdmin?: boolean
  children: React.ReactNode
}

/**
 * Casca visual comum a todas as telas autenticadas. Usada pelo layout do
 * grupo de rotas `(app)` — ver src/app/(app)/layout.tsx. `/login` fica FORA
 * deste grupo e não recebe Sidebar/Topbar.
 */
export function AppShell({ role, fullName, unreadNotifications, notifications, isPlatformAdmin, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} isPlatformAdmin={isPlatformAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar fullName={fullName} role={role} unreadNotifications={unreadNotifications} notifications={notifications} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
