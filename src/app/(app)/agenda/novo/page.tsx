import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listLeaders } from "@/services/leaders"
import { listSupporters } from "@/services/supporters"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { AgendaForm } from "../agenda-form"

export const metadata: Metadata = { title: "Novo compromisso · Lidera+" }

export default async function NovoCompromissoPage() {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole

  if (!session || !can(role, "create", "agenda_events")) {
    redirect("/agenda")
  }

  const isLideranca = role === "lideranca"
  const supabase = await createClient()
  const [leaders, supporters] = await Promise.all([
    isLideranca ? Promise.resolve([]) : listLeaders(supabase),
    listSupporters(supabase, {
      leaderId: isLideranca ? session.profile.leader_id ?? undefined : undefined,
    }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Novo compromisso</h1>
      <AgendaForm
        leaders={leaders.map((l) => ({ id: l.id, name: l.name }))}
        supporters={supporters.map((s) => ({ id: s.id, name: s.name }))}
        lockedToOwnNetwork={isLideranca}
      />
    </div>
  )
}
