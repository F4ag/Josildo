"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  createMessageTemplate, updateMessageTemplate, getMessageTemplateById,
  toggleMessageTemplateStatus, type MessageTemplateInput,
} from "@/services/message-templates"
import { messageTemplateSchema } from "@/lib/validations/message-template"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import type { ActionState } from "@/app/login/actions"

export async function createMessageTemplateAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "create", "message_templates")) {
    return { error: "Seu perfil não pode criar modelos de mensagem." }
  }

  const parsed = messageTemplateSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    subject: formData.get("subject") || undefined,
    body: formData.get("body"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  const input: MessageTemplateInput = {
    name: parsed.data.name,
    type: parsed.data.type,
    subject: parsed.data.subject || null,
    body: parsed.data.body,
  }

  await createMessageTemplate(supabase, input, session.id)
  revalidatePath("/mensagens")
  redirect("/mensagens")
}

export async function updateMessageTemplateAction(
  templateId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "update", "message_templates")) {
    return { error: "Seu perfil não pode editar modelos de mensagem." }
  }

  const parsed = messageTemplateSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    subject: formData.get("subject") || undefined,
    body: formData.get("body"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  await updateMessageTemplate(supabase, templateId, {
    name: parsed.data.name,
    type: parsed.data.type,
    subject: parsed.data.subject || null,
    body: parsed.data.body,
  })

  revalidatePath(`/mensagens/${templateId}`)
  revalidatePath("/mensagens")
  redirect("/mensagens")
}

export async function toggleMessageTemplateStatusAction(templateId: string) {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "update", "message_templates")) return

  const supabase = await createClient()
  const template = await getMessageTemplateById(supabase, templateId)
  if (!template) return

  await toggleMessageTemplateStatus(supabase, templateId, template.status as "ativo" | "inativo")
  revalidatePath("/mensagens")
}
