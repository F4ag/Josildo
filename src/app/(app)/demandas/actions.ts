"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createDemand, getDemandById, updateDemandStatus, type DemandInput } from "@/services/demands"
import { demandSchema, demandStatusUpdateSchema } from "@/lib/validations/demand"
import { can } from "@/lib/permissions"
import { geocodeAddress } from "@/lib/geocoding"
import type { UserRole } from "@/types/domain"
import type { ActionState } from "@/app/login/actions"

/** "" -> null, "-23.5" -> -23.5. Ver comentário em liderancas/actions.ts. */
function parseCoord(value: string | undefined): number | null {
  return value ? Number(value) : null
}

/** Prioriza lat/lng digitados à mão; só chama o geocoder quando o campo
 * ficou em branco no formulário. */
async function resolveCoords(data: {
  latitude?: string; longitude?: string; address?: string; neighborhood?: string; zip_code?: string
}): Promise<{ latitude: number | null; longitude: number | null }> {
  const manualLat = parseCoord(data.latitude)
  const manualLng = parseCoord(data.longitude)
  if (manualLat !== null && manualLng !== null) {
    return { latitude: manualLat, longitude: manualLng }
  }

  const found = await geocodeAddress({
    address: data.address, neighborhood: data.neighborhood, zipCode: data.zip_code,
  })
  return { latitude: found?.latitude ?? null, longitude: found?.longitude ?? null }
}

export async function createDemandAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "create", "demands")) {
    return { error: "Seu perfil não pode registrar demandas." }
  }

  const parsed = demandSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    demand_type: formData.get("demand_type") || "",
    leader_id: formData.get("leader_id") || "",
    supporter_id: formData.get("supporter_id") || "",
    address: formData.get("address") || undefined,
    neighborhood: formData.get("neighborhood") || undefined,
    zip_code: formData.get("zip_code") || undefined,
    latitude: formData.get("latitude") || "",
    longitude: formData.get("longitude") || "",
    priority: formData.get("priority") || "media",
    due_date: formData.get("due_date") || "",
    public_agency: formData.get("public_agency") || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  // Liderança só registra demanda vinculada à própria rede.
  const leaderId = role === "lideranca" ? session.profile.leader_id : parsed.data.leader_id || null
  if (role === "lideranca" && !leaderId) {
    return { error: "Sua conta de liderança não está vinculada a um cadastro de liderança." }
  }

  const coords = await resolveCoords(parsed.data)

  // zip_code só existe no schema/formulário pra ajudar a geocodificação
  // acima — a tabela demands não tem essa coluna, então ele é descartado
  // aqui antes de montar o objeto que vai pro banco (ver comentário em
  // lib/validations/demand.ts).
  const { zip_code: _zipCode, ...demandFields } = parsed.data

  const supabase = await createClient()
  const input: DemandInput = {
    ...demandFields,
    demand_type: parsed.data.demand_type || null,
    leader_id: leaderId,
    supporter_id: parsed.data.supporter_id || null,
    due_date: parsed.data.due_date || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
  }

  const demand = await createDemand(supabase, input, session.id, session.profile.organization_id)
  revalidatePath("/demandas")
  revalidatePath("/mapa")
  redirect(`/demandas/${demand.id}`)
}

export async function updateDemandStatusAction(
  demandId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "update_status", "demands")) {
    return { error: "Seu perfil não pode atualizar o status de demandas." }
  }

  const parsed = demandStatusUpdateSchema.safeParse({
    status: formData.get("status"),
    comment: formData.get("comment") || undefined,
    result_description: formData.get("result_description") || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  const demand = await getDemandById(supabase, demandId)
  if (!demand) return { error: "Demanda não encontrada." }

  await updateDemandStatus(
    supabase,
    { id: demand.id, leader_id: demand.leader_id, supporter_id: demand.supporter_id, title: demand.title },
    { status: parsed.data.status, comment: parsed.data.comment, resultDescription: parsed.data.result_description },
    session.id,
    session.profile.organization_id,
  )

  revalidatePath(`/demandas/${demandId}`)
  revalidatePath("/demandas")
  revalidatePath("/mapa")
  return { error: null, success: true }
}
