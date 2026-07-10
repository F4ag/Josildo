import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getMessageTemplateById } from "@/services/message-templates"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { MessageTemplateForm } from "../message-template-form"

export const metadata: Metadata = { title: "Editar modelo de mensagem · Lidera+" }

export default async function EditarModeloMensagemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole

  if (!session || !can(role, "update", "message_templates")) {
    redirect("/mensagens")
  }

  const supabase = await createClient()
  const template = await getMessageTemplateById(supabase, id)
  if (!template) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Editar modelo de mensagem</h1>
      <MessageTemplateForm template={template} />
    </div>
  )
}
