import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listLeaders } from "@/services/leaders"
import { listSupporters } from "@/services/supporters"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { DemandForm } from "../demand-form"

export const metadata: Metadata = { title: "Nova demanda · Lidera+" }

export default async function NovaDemandaPage() {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole

  if (!session || !can(role, "create", "demands")) {
    redirect("/demandas")
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
      <h1 className="text-xl font-semibold text-foreground">Nova demanda</h1>
      <DemandForm
        leaders={leaders.map((l) => ({ id: l.id, name: l.name }))}
        supporters={supporters.map((s) => ({ id: s.id, name: s.name, leader_id: s.leader_id }))}
        lockedToOwnNetwork={isLideranca}
      />
    </div>
  )
}
