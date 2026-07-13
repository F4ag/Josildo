import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrganizationById } from "@/services/organizations"
import { updateClientAction } from "../../actions"
import { ClientEditForm } from "./client-edit-form"

export const metadata: Metadata = { title: "Editar cliente · Lidera+" }

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSessionUser()
  if (!session?.profile.is_platform_admin) notFound()

  const admin = createAdminClient()
  const org = await getOrganizationById(admin, id)
  if (!org) notFound()

  const boundAction = updateClientAction.bind(null, id)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Editar cliente</h1>
      <ClientEditForm
        action={boundAction}
        defaultValues={{ name: org.name, slug: org.slug, status: org.status }}
      />
    </div>
  )
}
