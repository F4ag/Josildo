"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  createSupporter, updateSupporter, findPotentialDuplicates, getSupporterById, type SupporterInput,
} from "@/services/supporters"
import { supporterSchema } from "@/lib/validations/supporter"
import { can } from "@/lib/permissions"
import { geocodeAddress } from "@/lib/geocoding"
import type { UserRole } from "@/types/domain"

export type SupporterActionState = {
  error: string | null
  success?: boolean
  duplicates?: { id: string; name: string; phone: string; neighborhood: string | null }[]
}

/** "" -> null, "-23.5" -> -23.5. Nunca retorna NaN nem 0 pra campo vazio
 * (ver comentário em lib/validations/supporter.ts sobre "Null Island"). */
function parseCoord(value: string | undefined): number | null {
  return value ? Number(value) : null
}

/** Só tenta geocodificar quando ninguém preencheu lat/lng à mão — o
 * cadastro manual sempre vence a busca automática. */
async function resolveCoords(data: {
  latitude?: string; longitude?: string
  address?: string; neighborhood?: string; city?: string; state?: string; zip_code?: string
}): Promise<{ latitude: number | null; longitude: number | null }> {
  const manualLat = parseCoord(data.latitude)
  const manualLng = parseCoord(data.longitude)
  if (manualLat !== null && manualLng !== null) {
    return { latitude: manualLat, longitude: manualLng }
  }

  const found = await geocodeAddress({
    address: data.address, neighborhood: data.neighborhood, city: data.city, state: data.state,
    zipCode: data.zip_code,
  })
  return { latitude: found?.latitude ?? null, longitude: found?.longitude ?? null }
}

function parseSupporterForm(formData: FormData) {
  return supporterSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    birth_date: formData.get("birth_date"),
    address: formData.get("address"),
    email: formData.get("email") || "",
    neighborhood: formData.get("neighborhood") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    zip_code: formData.get("zip_code") || undefined,
    latitude: formData.get("latitude") || "",
    longitude: formData.get("longitude") || "",
    leader_id: formData.get("leader_id") || "",
    origin: formData.get("origin") || "",
    gender: formData.get("gender") || undefined,
    profession: formData.get("profession") || undefined,
    consent_whatsapp: formData.get("consent_whatsapp") === "on",
    consent_email: formData.get("consent_email") === "on",
    consent_registration: formData.get("consent_registration") === "on",
    notes: formData.get("notes") || undefined,
  })
}

export async function createSupporterAction(
  _prevState: SupporterActionState,
  formData: FormData,
): Promise<SupporterActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "create", "supporters")) {
    return { error: "Seu perfil não pode cadastrar apoiadores." }
  }

  const parsed = parseSupporterForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()

  // Liderança só cadastra na própria rede — mesmo que o campo leader_id
  // venha manipulado no form, a RLS bloquearia, mas fixamos aqui para dar
  // um erro claro em vez de um 403 silencioso do Postgres.
  const leaderId =
    role === "lideranca" ? session.profile.leader_id : parsed.data.leader_id || null

  if (role === "lideranca" && !leaderId) {
    return { error: "Sua conta de liderança não está vinculada a um cadastro de liderança." }
  }

  const forcedDuplicate = formData.get("force_duplicate") === "on"
  if (!forcedDuplicate) {
    const duplicates = await findPotentialDuplicates(supabase, {
      name: parsed.data.name,
      phone: parsed.data.phone,
      birth_date: parsed.data.birth_date,
      address: parsed.data.address,
    })
    if (duplicates.length > 0) {
      return { error: null, duplicates }
    }
  }

  const coords = await resolveCoords(parsed.data)

  const input: SupporterInput = {
    ...parsed.data,
    email: parsed.data.email || null,
    origin: parsed.data.origin || null,
    leader_id: leaderId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    consent_date: new Date().toISOString(),
    consent_origin: "cadastro_interno",
  }

  const supporter = await createSupporter(supabase, input, session.id, session.profile.organization_id)
  revalidatePath("/apoiadores")
  revalidatePath("/mapa")
  redirect(`/apoiadores/${supporter.id}`)
}

export async function updateSupporterAction(
  supporterId: string,
  _prevState: SupporterActionState,
  formData: FormData,
): Promise<SupporterActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole
  const supabase = await createClient()

  let isOwnNetwork = false
  if (role === "lideranca") {
    const existing = await getSupporterById(supabase, supporterId)
    isOwnNetwork = existing?.leader_id === session.profile.leader_id
  }

  if (!can(role, "update", "supporters") && !isOwnNetwork) {
    return { error: "Você não tem permissão para editar este apoiador." }
  }

  const parsed = parseSupporterForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const coords = await resolveCoords(parsed.data)

  const input: Partial<SupporterInput> = {
    ...parsed.data,
    email: parsed.data.email || null,
    origin: parsed.data.origin || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
  }
  // Liderança não transfere o apoiador para outra rede.
  if (role === "lideranca") delete input.leader_id

  await updateSupporter(supabase, supporterId, input)
  revalidatePath("/apoiadores")
  revalidatePath(`/apoiadores/${supporterId}`)
  revalidatePath("/mapa")
  redirect(`/apoiadores/${supporterId}`)
}
