"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createLeader, updateLeader, deleteLeader, type LeaderInput } from "@/services/leaders"
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

async function resolveCoords(data: { latitude: string; longitude: string; address?: string; neighborhood?: string; city?: string; state?: string; zip_code?: string }) {
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

  // Criar o acesso de login junto com o cadastro é restrito a admin_geral —
  // mesma restrição de configuracoes/usuarios/actions.ts (assertAdminGeral),
  // já que isso usa o client de service_role. O formulário já esconde o
  // checkbox pra qualquer outro perfil (showInviteLoginOption em
  // liderancas/novo/page.tsx); isto aqui é a segunda barreira.
  const wantsLogin = role === "admin_geral" && formData.get("create_login") === "on"
  const inviteChannel = formData.get("invite_channel") === "whatsapp" ? "whatsapp" : "email"
  if (wantsLogin && !parsed.data.email) {
    return { error: "Informe o e-mail da liderança para criar o acesso de login." }
  }
  if (wantsLogin && inviteChannel === "whatsapp" && !parsed.data.phone) {
    return { error: "Informe o WhatsApp da liderança para enviar o convite por esse canal." }
  }

  const coords = await resolveCoords(parsed.data)

  // Convite acontece ANTES de criar a linha em leaders: se o e-mail já tiver
  // conta ou o convite falhar por qualquer motivo, a liderança nunca chega a
  // ser criada "pela metade" (cadastrada, mas sem explicação de por que o
  // login não saiu). Ver o mesmo cuidado em configuracoes/usuarios/actions.ts.
  //
  // Canal WhatsApp: Supabase Auth não manda WhatsApp sozinho, então em vez de
  // inviteUserByEmail (que já dispara o e-mail automaticamente) usamos
  // generateLink — cria o mesmo usuário e devolve o MESMO link de definir
  // senha que iria por e-mail, mas SEM enviar nada. O link volta pro cliente
  // via query string no redirect abaixo, pra abrir o wa.me (lib/whatsapp.ts,
  // Módulo 12, mesmo esquema sem API paga usado no resto do app) com o
  // número já preenchido.
  let invitedUserId: string | null = null
  let whatsappInviteLink: string | null = null
  if (wantsLogin) {
    const admin = createAdminClient()
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/redefinir-senha`
    if (inviteChannel === "whatsapp") {
      const { data: linked, error: linkError } = await admin.auth.admin.generateLink({
        type: "invite",
        email: parsed.data.email!,
        options: { redirectTo },
      })
      if (linkError || !linked.user) {
        return { error: `Não foi possível gerar o convite para este e-mail: ${linkError?.message ?? "erro desconhecido"}.` }
      }
      invitedUserId = linked.user.id
      whatsappInviteLink = linked.properties.action_link
    } else {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email!, {
        redirectTo,
      })
      if (inviteError || !invited.user) {
        return { error: `Não foi possível convidar este e-mail: ${inviteError?.message ?? "erro desconhecido"}.` }
      }
      invitedUserId = invited.user.id
    }
  }

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
    // user_id NÃO entra aqui: a FK leaders_user_id_fkey aponta pra
    // users_profiles(id), e essa linha só é criada MAIS ABAIXO (depois da
    // liderança existir, pois users_profiles.leader_id aponta pra leaders).
    // Setar user_id já nesta inserção violava a FK (leader criado antes do
    // perfil existir) — vinculamos com um UPDATE só depois que o perfil for
    // criado com sucesso.
  }

  // Hierarquia: quando quem cadastra é a própria liderança, a nova linha
  // vira "filha" dela automaticamente (parent_leader_id) — o formulário nem
  // expõe esse campo, e a RLS (ld_lideranca_insert_subordinate) recusaria
  // qualquer outro valor mesmo que alguém tentasse forjar a requisição.
  // Também zera os campos administrativos: uma liderança não decide o
  // próprio nível de influência/status de quem ela recruta (mesma barreira
  // já aplicada em updateLeaderAction pra edição do próprio cadastro).
  // admin_estimated_votes segue a mesma regra — mesmo que o formulário nem
  // exiba esse campo pra role lideranca, zera aqui também como segunda
  // barreira (defesa em profundidade, igual ao restante do bloco).
  if (role === "lideranca") {
    input.parent_leader_id = session.profile.leader_id
    input.influence_level = null
    input.status = "ativa"
    input.can_view_attendances = false
    input.admin_estimated_votes = null
  }

  let leader: Awaited<ReturnType<typeof createLeader>>
  if (invitedUserId) {
    // Convite já saiu — se a criação da liderança falhar agora, desfaz o
    // convite pra não deixar um login sem liderança nem perfil vinculados.
    try {
      leader = await createLeader(supabase, input, session.id, session.profile.organization_id)
    } catch (err) {
      await createAdminClient().auth.admin.deleteUser(invitedUserId)
      return { error: err instanceof Error ? err.message : "Falha ao cadastrar liderança." }
    }
  } else {
    leader = await createLeader(supabase, input, session.id, session.profile.organization_id)
  }

  if (invitedUserId) {
    const admin = createAdminClient()
    // Mesmo shape de configuracoes/usuarios/actions.ts (inviteUser): cria o
    // perfil vinculado à liderança recém-criada, já com role lideranca (que
    // já tem supporters.create:true na matriz de permissões — ver
    // lib/permissions.ts — por isso não precisa de mais nenhuma autorização
    // separada pra ela cadastrar apoiadores).
    const { error: profileError } = await admin.from("users_profiles").insert({
      id: invitedUserId,
      organization_id: session.profile.organization_id,
      full_name: leader.name,
      email: leader.email,
      phone: leader.phone,
      role: "lideranca",
      leader_id: leader.id,
    })

    if (profileError) {
      // Não deixar login nem liderança órfãos: desfaz os dois e avisa.
      await admin.auth.admin.deleteUser(invitedUserId)
      await deleteLeader(supabase, leader.id).catch(() => {})
      return { error: `Não foi possível concluir o cadastro: falha ao criar o acesso de login (${profileError.message}).` }
    }

    // Só agora o perfil existe de fato — completa o vínculo bidirecional
    // atualizando leaders.user_id (usa o client de service_role pra não
    // depender de nenhuma policy de update específica pra esse campo).
    const { error: linkError } = await admin.from("leaders").update({ user_id: invitedUserId }).eq("id", leader.id)
    if (linkError) {
      await admin.auth.admin.deleteUser(invitedUserId)
      await admin.from("users_profiles").delete().eq("id", invitedUserId)
      await deleteLeader(supabase, leader.id).catch(() => {})
      return { error: `Não foi possível concluir o cadastro: falha ao vincular o login à liderança (${linkError.message}).` }
    }

    revalidatePath("/configuracoes/usuarios")
  }

  revalidatePath("/liderancas")
  revalidatePath("/mapa")
  let query = ""
  if (invitedUserId && inviteChannel === "whatsapp" && whatsappInviteLink) {
    query = `?convite=whatsapp&link=${encodeURIComponent(whatsappInviteLink)}`
  } else if (invitedUserId) {
    query = "?convite=enviado"
  }
  redirect(`/liderancas/${leader.id}${query}`)
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
  try {
    await deleteLeader(supabase, leaderId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao excluir liderança." }
  }

  revalidatePath("/liderancas")
  revalidatePath("/mapa")
  redirect("/liderancas")
}
