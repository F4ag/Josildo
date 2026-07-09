import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getSupporterById } from "@/services/supporters"
import { listLeaders } from "@/services/leaders"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { SupporterForm } from "../../supporter-form"
import { updateSupporterAction } from "../../actions"

export const metadata: Metadata = { title: "Editar apoiador · Lidera+" }

export default async function EditarApoiadorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSessionUser()
  const supabase = await createClient()
  const supporter = await getSupporterById(supabase, id)

  if (!supporter) notFound()

  const role = session?.profile.role as UserRole
  const isOwnNetwork = role === "lideranca" && supporter.leader_id === session?.profile.leader_id
  if (!can(role, "update", "supporters") && !isOwnNetwork) {
    redirect(`/apoiadores/${id}`)
  }

  const isLideranca = role === "lideranca"
  const leaders = isLideranca ? [] : await listLeaders(supabase)
  const boundAction = updateSupporterAction.bind(null, id)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Editar apoiador</h1>
      <SupporterForm
        action={boundAction}
        defaultValues={supporter}
        leaders={leaders.map((l) => ({ id: l.id, name: l.name }))}
        lockedToOwnNetwork={isLideranca}
        cancelHref={`/apoiadores/${id}`}
      />
    </div>
  )
}
