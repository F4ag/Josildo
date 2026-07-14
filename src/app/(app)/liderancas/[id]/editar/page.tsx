import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLeaderById } from "@/services/leaders"
import { getPollingLocationById, formatPollingLocationLabel } from "@/services/polling-locations"
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

  // O cadastro só guarda o polling_location_id — sem isso, o autocomplete
  // apareceria vazio na edição mesmo com um local já selecionado.
  const pollingLocation = leader.polling_location_id
    ? await getPollingLocationById(supabase, leader.polling_location_id)
    : null

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
        pollingLocationDefaultLabel={pollingLocation ? formatPollingLocationLabel(pollingLocation) : null}
        cancelHref={`/liderancas/${id}`}
      />
    </div>
  )
}
