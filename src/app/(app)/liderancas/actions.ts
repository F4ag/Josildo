"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createLeader, updateLeader, type LeaderInput } from "@/services/leaders"
import { leaderSchema } from "@/lib/validations/leader"
import { can } from "@/lib/permissions"
import { geocodeAddress } from "@/lib/geocoding"
import type { UserRole } from "@/types/domain"
import type { ActionState } from "@/app/login/actions"

/** "" -> null, "-23.5" -> -23.5. Nunca retorna NaN nem 0 pra campo vazio
 * (ver comentário em lib/validations/leader.ts sobre "Null Island"). */
function parseCoord(value: string | undefined): number | null {
  return value ? Number(value) : null
}

function parseLeaderForm(formData: FormData) {
  return leaderSchema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || "",
    birth_date: formData.get("birth_date") || "",
    address: formData.get("address") || undefined,
    neighborhood: formData.get("neighborhood") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    zip_code: formData.get("zip_code") || undefined,
    latitude: formData.get("latitude") || "",
    longitude: formData.get("longitude") || "",
    leader_type: formData.get("leader_type") || "",
    influence_level: formData.get("influence_level") || "",
    status: formData.get("status") || "ativa",
    can_view_attendances: formData.get("can_view_attendances") === "on",
    notes: formData.get("notes") || undefined,
  })
}

/** Só tenta geocodificar quando ninguém preencheu lat/lng à mão — o
 * cadastro manual sempre vence a busca automática. */
async function resolveCoords(data: {
  latitude?: string; longitude?: string
  address?: string; neighborhood?: string; city?: string; state?: string
}): Promise<{ latitude: number | null; longitude: number | null }> {
  const manualLat = parseCoord(data.latitude)
  const manualLng = parseCoord(data.longitude)
  if (manualLat !== null && manualLng !== null) {
    return { latitude: manualLat, longitude: manualLng }
  }

  const found = await geocodeAddress({
    address: data.address, neighborhood: data.neighborhood, city: data.city, state: data.state,
  })
  return { latitude: found?.latitude ?? null, longitude: found?.longitude ?? null }
}

export async function createLeaderAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "create", "leaders")) {
    return { error: "Seu perfil não pode cadastrar lideranças." }
  }

  const parsed = parseLeaderForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const coords = await resolveCoords(parsed.data)

  const supabase = await createClient()
  const input: LeaderInput = {
    ...parsed.data,
    email: parsed.data.email || null,
    birth_date: parsed.data.birth_date || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    leader_type: parsed.data.leader_type || null,
    influence_level: parsed.data.influence_level || null,
  }

  const leader = await createLeader(supabase, input, session.id)
  revalidatePath("/liderancas")
  redirect(`/liderancas/${leader.id}`)
}

export async function updateLeaderAction(
  leaderId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  const isOwnRecord = role === "lideranca" && session.profile.leader_id === leaderId
  if (!can(role, "update", "leaders") && !isOwnRecord) {
    return { error: "Você não tem permissão para editar esta liderança." }
  }

  const parsed = parseLeaderForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const coords = await resolveCoords(parsed.data)

  const supabase = await createClient()
  const input: Partial<LeaderInput> = {
    ...parsed.data,
    email: parsed.data.email || null,
    birth_date: parsed.data.birth_date || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    leader_type: parsed.data.leader_type || null,
    influence_level: parsed.data.influence_level || null,
  }

  // Liderança não pode se auto-promover a status "estratégica" nem alterar
  // o próprio nível de influência — RLS permite a escrita, então a barreira
  // fica aqui (nota também deixada em rls_policies.sql).
  if (isOwnRecord) {
    delete input.influence_level
    delete input.status
    delete input.can_view_attendances
  }

  await updateLeader(supabase, leaderId, input)
  revalidatePath("/liderancas")
  revalidatePath(`/liderancas/${leaderId}`)
  redirect(`/liderancas/${leaderId}`)
}
