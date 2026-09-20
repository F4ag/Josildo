"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createLeader, updateLeader, deleteLeader, getLeaderById, type LeaderInput } from "@/services/leaders"
import { generateLeaderAccessToken, revokeLeaderAccess } from "@/services/leader-access"
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
    cpf: formData.get("cpf") || undefined,
    mother_name: formData.get("mother_name") || undefined,
    address: formData.get("address") || undefined,
    complement: formData.get("complement") || undefined,
    neighborhood: formData.get("neighborhood") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    zip_code: formData.get("zip_code") || undefined,
    polling_location_id: formData.get("polling_location_id") || "",
    electoral_zone: formData.get("electoral_zone") || undefined,
    electoral_section: formData.get("electoral_section") || undefined,
    latitude: formData.get("latitude") || "",
    longitude: formData.get("longitude") || "",
    leader_type: formData.get("leader_type") || "",
    influence_level: formData.get("influence_level") || "",
    status: formData.get("status") || "ativa",
    can_view_attendances: formData.get("can_view_attendances") === "on",
    expected_votes: formData.get("expected_votes") || "",
    admin_estimated_votes: formData.get("admin_estimated_votes") || "",
    notes: formData.get("notes") || undefined,
  })
}

function parseVotes(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function resolveCoords(data: { latitude?: string; longitude?: string; address?: string; neighborhood?: string; city?: string; state?: string; zip_code?: string }) {
  const latitude = parseCoord(data.latitude)
  const longitude = parseCoord(data.longitude)
  if (latitude != null && longitude != null) return { latitude, longitude }
  if (!data.address && !data.zip_code) return { latitude: null, longitude: null }

  const found = await geocodeAddress({
    address: data.address,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    zipCode: data.zip_code,
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
    expected_votes: parseVotes(parsed.data.expected_votes),
    admin_estimated_votes: parseVotes(parsed.data.admin_estimated_votes),
    polling_location_id: parsed.data.polling_location_id || null,
  }

  const leader = await createLeader(supabase, input, session.id, session.profile.organization_id)

  // Só admin_geral ganha o link de acesso automaticamente ao cadastrar —
  // admin_equipe também cadastra liderança, mas o link fica pendente até um
  // admin_geral gerar na tela de detalhe (mesma trava que já existia pro
  // convite por e-mail antes desta mudança). Ver
  // docs/08-acesso-lideranca-sem-senha.md §5.
  if (role === "admin_geral") {
    const admin = createAdminClient()
    try {
      await generateLeaderAccessToken(admin, leader, session.profile.organization_id)
    } catch {
      // A liderança já foi criada com sucesso — não desfaz o cadastro por
      // uma falha ao gerar o link; ela só fica "sem acesso" até o
      // admin_geral tentar de novo na tela de detalhe (botão "Gerar link de
      // acesso").
      revalidatePath("/liderancas")
      revalidatePath("/mapa")
      redirect(`/liderancas/${leader.id}?erro_link=1`)
    }
  }

  revalidatePath("/liderancas")
  revalidatePath("/mapa")
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
  // Liderança só edita o próprio cadastro — nunca o de uma sub-liderança
  // (ver mesma nota em liderancas/[id]/page.tsx e [id]/editar/page.tsx).
  const canEdit = role === "lideranca" ? isOwnRecord : can(role, "update", "leaders")
  if (!canEdit) {
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
    expected_votes: parseVotes(parsed.data.expected_votes),
    admin_estimated_votes: parseVotes(parsed.data.admin_estimated_votes),
    polling_location_id: parsed.data.polling_location_id || null,
  }

  // Liderança não pode se auto-promover a status "estratégica" nem alterar
  // o próprio nível de influência — RLS permite a escrita, então a barreira
  // fica aqui (nota também deixada em rls_policies.sql). admin_estimated_votes
  // segue a mesma regra: é a avaliação real do admin sobre a liderança, ela
  // não pode nem ver nem mexer no próprio cadastro.
  if (isOwnRecord) {
    delete input.influence_level
    delete input.status
    delete input.can_view_attendances
    delete input.admin_estimated_votes
  }

  await updateLeader(supabase, leaderId, input)
  revalidatePath("/liderancas")
  revalidatePath(`/liderancas/${leaderId}`)
  revalidatePath("/mapa")
  redirect(`/liderancas/${leaderId}`)
}

export async function deleteLeaderAction(
  leaderId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  // Exclusão é ação sensível: só admin_geral (mesma regra da RLS —
  // policy ld_admin_geral_all — ver comentário em services/leaders.ts).
  if (!can(role, "delete", "leaders")) {
    return { error: "Seu perfil não pode excluir lideranças." }
  }

  const supabase = await createClient()
  const leader = await getLeaderById(supabase, leaderId)
  if (!leader) {
    return { error: "Liderança não encontrada." }
  }

  // O login vinculado (se houver) é apagado primeiro. leaders.user_id e
  // fk_users_profiles_leader agora são "on delete set null" dos dois lados
  // (ver supabase/schema.sql) — isso resolveu a referência circular que
  // existia antes (leaders.user_id <-> users_profiles.leader_id, ambas sem
  // cascade): apagar o usuário de auth já limpa users_profiles sozinho
  // (users_profiles_id_fkey on delete cascade) e zera leaders.user_id sem
  // precisar de nenhum passo manual de desvínculo antes.
  if (leader.user_id) {
    const { error: authError } = await createAdminClient().auth.admin.deleteUser(leader.user_id)
    if (authError) {
      return { error: `Falha ao excluir o login da liderança: ${authError.message}` }
    }
  }

  try {
    // A linha de leader_access_tokens sai junto por cascata daqui (ver
    // supabase/schema.sql).
    await deleteLeader(supabase, leaderId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao excluir liderança." }
  }

  revalidatePath("/liderancas")
  revalidatePath("/mapa")
  redirect("/liderancas")
}

/** Restrição igual à de configuracoes/usuarios/actions.ts (assertAdminGeral):
 * gerenciar o acesso de outra pessoa usa o client de service_role, então só
 * admin_geral pode chegar até aqui. */
export async function generateLeaderAccessLinkAction(
  leaderId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  const session = await requireSessionUser()
  if (session.profile.role !== "admin_geral") {
    return { error: "Apenas o Admin Geral pode gerenciar o acesso de lideranças." }
  }

  const supabase = await createClient()
  const leader = await getLeaderById(supabase, leaderId)
  if (!leader) {
    return { error: "Liderança não encontrada." }
  }

  const admin = createAdminClient()
  try {
    await generateLeaderAccessToken(admin, leader, session.profile.organization_id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao gerar o link de acesso." }
  }

  revalidatePath(`/liderancas/${leaderId}`)
  return { error: null }
}

export async function revokeLeaderAccessAction(
  leaderId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  const session = await requireSessionUser()
  if (session.profile.role !== "admin_geral") {
    return { error: "Apenas o Admin Geral pode gerenciar o acesso de lideranças." }
  }

  const supabase = await createClient()
  const leader = await getLeaderById(supabase, leaderId)
  if (!leader) {
    return { error: "Liderança não encontrada." }
  }

  const admin = createAdminClient()
  try {
    await revokeLeaderAccess(admin, leaderId, leader.user_id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao revogar o acesso." }
  }

  revalidatePath(`/liderancas/${leaderId}`)
  return { error: null }
}
