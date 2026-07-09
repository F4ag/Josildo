import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listSupporters } from "@/services/supporters"
import { listLeaders } from "@/services/leaders"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { AttendanceForm } from "../attendance-form"

export const metadata: Metadata = { title: "Novo atendimento · Lidera+" }

export default async function NovoAtendimentoPage() {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole

  if (!session || !can(role, "create", "attendances")) {
    redirect("/atendimentos")
  }

  const supabase = await createClient()
  const [supporters, leaders] = await Promise.all([listSupporters(supabase), listLeaders(supabase)])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Novo atendimento</h1>
      <AttendanceForm
        supporters={supporters.map((s) => ({ id: s.id, name: s.name }))}
        leaders={leaders.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  )
}
