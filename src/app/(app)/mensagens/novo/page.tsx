import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { MessageTemplateForm } from "../message-template-form"

export const metadata: Metadata = { title: "Novo modelo de mensagem · Lidera+" }

export default async function NovoModeloMensagemPage() {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole

  if (!session || !can(role, "create", "message_templates")) {
    redirect("/mensagens")
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Novo modelo de mensagem</h1>
      <MessageTemplateForm />
    </div>
  )
}
