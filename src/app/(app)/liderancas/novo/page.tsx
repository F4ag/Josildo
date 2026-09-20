import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listNeighborhoods } from "@/services/neighborhoods"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { LeaderForm } from "../leader-form"
import { createLeaderAction } from "../actions"

export const metadata: Metadata = { title: "Nova liderança · Lidera+" }

export default async function NovaLiderancaPage() {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole
  if (!session || !can(role, "create", "leaders")) {
    redirect("/liderancas")
  }

  const supabase = await createClient()
  const neighborhoods = await listNeighborhoods(supabase)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Nova liderança</h1>
      <LeaderForm
        action={createLeaderAction} cancelHref="/liderancas"
        neighborhoods={neighborhoods.map((n) => ({ id: n.id, name: n.name }))}
      />
    </div>
  )
}
