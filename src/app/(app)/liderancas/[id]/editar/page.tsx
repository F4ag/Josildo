import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLeaderById } from "@/services/leaders"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { LeaderForm } from "../../leader-form"
import { updateLeaderAction } from "../../actions"

export const metadata: Metadata = { title: "Editar liderança · Lidera+" }

export default async function EditarLiderancaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSessionUser()
  const supabase = await createClient()
  const leader = await getLeaderById(supabase, id)

  if (!leader) notFound()

  const role = session?.profile.role as UserRole
  const isOwnRecord = role === "lideranca" && session?.profile.leader_id === id
  // Liderança só edita o próprio cadastro, nunca o de uma sub-liderança que
  // ela cadastrou (RLS ld_lideranca_update_self não cobre isso) — ver nota
  // igual em liderancas/[id]/page.tsx.
  const canEdit = role === "lideranca" ? isOwnRecord : can(role, "update", "leaders")
  if (!canEdit) {
    redirect(`/liderancas/${id}`)
  }

  const boundAction = updateLeaderAction.bind(null, id)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Editar liderança</h1>
      <LeaderForm
        action={boundAction}
        defaultValues={leader}
        isOwnRecord={isOwnRecord}
        cancelHref={`/liderancas/${id}`}
      />
    </div>
  )
}
