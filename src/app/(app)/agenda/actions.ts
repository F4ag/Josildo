"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAgendaEvent, updateAgendaEventStatus, type AgendaEventInput } from "@/services/agenda"
import { agendaEventSchema, agendaStatusUpdateSchema } from "@/lib/validations/agenda"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import type { ActionState } from "@/app/login/actions"

export async function createAgendaEventAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "create", "agenda_events")) {
    return { error: "Seu perfil não pode registrar compromissos na agenda." }
  }

  const parsed = agendaEventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    event_date: formData.get("event_date"),
    event_time: formData.get("event_time") || "",
    location: formData.get("location") || undefined,
    neighborhood: formData.get("neighborhood") || undefined,
    leader_id: formData.get("leader_id") || "",
    supporter_id: formData.get("supporter_id") || "",
    responsible_user_id: formData.get("responsible_user_id") || "",
    notes: formData.get("notes") || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  // Liderança só registra compromisso vinculado à própria rede — mesma
  // regra de demandas/actions.ts (RLS ag_lideranca_insert_own exige isso).
  const leaderId = role === "lideranca" ? session.profile.leader_id : parsed.data.leader_id || null
  if (role === "lideranca" && !leaderId) {
    return { error: "Sua conta de liderança não está vinculada a um cadastro de liderança." }
  }

  const supabase = await createClient()
  const input: AgendaEventInput = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    event_date: parsed.data.event_date,
    event_time: parsed.data.event_time || null,
    location: parsed.data.location || null,
    neighborhood: parsed.data.neighborhood || null,
    leader_id: leaderId,
    supporter_id: parsed.data.supporter_id || null,
    responsible_user_id: parsed.data.responsible_user_id || null,
    notes: parsed.data.notes || null,
  }

  await createAgendaEvent(supabase, input, session.id)
  revalidatePath("/agenda")
  redirect("/agenda")
}

export async function updateAgendaEventStatusAction(
  eventId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "update", "agenda_events")) {
    return { error: "Seu perfil não pode atualizar compromissos da agenda." }
  }

  const parsed = agendaStatusUpdateSchema.safeParse({ status: formData.get("status") })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  await updateAgendaEventStatus(supabase, eventId, parsed.data.status)

  revalidatePath(`/agenda/${eventId}`)
  revalidatePath("/agenda")
  return { error: null, success: true }
}
