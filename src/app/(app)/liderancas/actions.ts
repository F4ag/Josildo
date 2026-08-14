"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createLeader, updateLeader, deleteLeader, getLeaderById, type LeaderInput } from "@/services/leaders"
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

  // Login é criado ANTES da liderança (mesmo cuidado de sempre: se a
  // liderança falhar depois, o rollback abaixo desfaz o login, então nunca
  // fica uma liderança "pela metade" sem explicação de por que o acesso não
  // saiu — ver mesmo raciocínio em configuracoes/usuarios/actions.ts).
  //
  // MAS o disparo do convite em si (e-mail ou WhatsApp) só acontece DEPOIS
  // que TUDO — login, liderança, perfil, vínculo — já foi criado com
  // sucesso, no fim desta função. Antes, o canal e-mail usava
  // inviteUserByEmail aqui, que cria o usuário E manda o e-mail no mesmo
  // passo — se createLeader (ou a criação do perfil, ou o vínculo)
  // falhasse por qualquer motivo LOGO DEPOIS, o rollback apagava o login,
  // mas o e-mail já tinha saído e continuava "válido" na caixa de entrada.
  // A pessoa clicava minutos depois num link de uma conta que já não
  // existia mais e via "link inválido ou expirado" sem nenhuma pista do
  // motivo real (bug real, encontrado em produção — ver conversa com o
  // Josildo). Por isso agora o canal e-mail também usa createUser (que,
  // como generateLink, NUNCA envia nada sozinho) — só cria a conta em
  // silêncio — e o disparo de verdade vira responsabilidade só do bloco no
  // fim da função, que só roda se absolutamente tudo tiver dado certo.
  let invitedUserId: string | null = null
  let whatsappInviteLink: string | null = null
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/redefinir-senha`
  if (wantsLogin) {
    const admin = createAdminClient()
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
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: parsed.data.email!,
        email_confirm: false,
      })
      if (createError || !created.user) {
        return { error: `Não foi possível criar o acesso para este e-mail: ${createError?.message ?? "erro desconhecido"}.` }
      }
      invitedUserId = created.user.id
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

  // Só chega aqui se login + liderança + perfil + vínculo deram certo (todo
  // caminho de erro acima já retornou antes). Agora sim, com tudo pronto,
  // dispara o convite de verdade pro canal e-mail — mesmo mecanismo já
  // comprovado confiável em "esqueci senha" (login/actions.ts) e no reenvio
  // por e-mail (resendInviteAction abaixo): resetPasswordForEmail dispara
  // o e-mail de "definir senha" de verdade pra um usuário que já existe.
  // Falha aqui não desfaz o cadastro (login/liderança já existem de fato) —
  // só significa que o admin vai precisar usar "Reenviar convite de
  // acesso" na página da liderança.
  if (invitedUserId && inviteChannel === "email") {
    await supabase.auth.resetPasswordForEmail(parsed.data.email!, { redirectTo }).catch(() => {})
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
  // Pego o user_id ANTES de excluir — depois que a liderança some, não tem
  // mais como descobrir qual login estava vinculado a ela.
  const leader = await getLeaderById(supabase, leaderId)
  const userIdToRemove = leader?.user_id ?? null

  try {
    await deleteLeader(supabase, leaderId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao excluir liderança." }
  }

  // Exclusão em cascata do acesso de login, quando existir: excluir só a
  // liderança e deixar a conta órfã (só desvinculada, não apagada — ver
  // leaders_user_id_fkey em schema.sql) causava confusão real — ex.: tentar
  // recadastrar a mesma pessoa com o mesmo e-mail falhava com "already
  // registered", porque a conta antiga continuava existindo sem nenhuma
  // liderança vinculada. Feito só DEPOIS de confirmar que a liderança foi
  // excluída com sucesso: se a exclusão acima falhar (apoiadores/demandas
  // vinculados), a conta de login nem é tocada — sem efeito colateral
  // parcial. Falha ao apagar a conta em si (ex.: race condition) não deve
  // impedir a resposta de sucesso pro usuário, já que a liderança já foi
  // excluída de fato — por isso o catch silencioso aqui.
  if (userIdToRemove) {
    const admin = createAdminClient()
    await admin.auth.admin.deleteUser(userIdToRemove).catch(() => {})
  }

  revalidatePath("/liderancas")
  revalidatePath("/mapa")
  redirect("/liderancas")
}

/**
 * Reenvia o convite de acesso de uma liderança que já tem login criado —
 * pra quando o e-mail original foi digitado errado (ou a pessoa simplesmente
 * não recebeu) e não tinha como reenviar sem excluir e recadastrar do zero.
 * Mesma restrição de sempre pra mexer em login (admin_geral, client de
 * service_role — ver createLeaderAction acima e
 * configuracoes/usuarios/actions.ts).
 *
 * Não serve pra CRIAR o primeiro acesso de uma liderança que nunca teve
 * login (isso é feito no cadastro, ou em Configurações > Usuários pra quem
 * já existe sem conta — listLeadersWithoutAccount em services/leaders.ts).
 */
export async function resendInviteAction(
  leaderId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (role !== "admin_geral") {
    return { error: "Seu perfil não pode reenviar convites de acesso." }
  }

  const supabase = await createClient()
  const leader = await getLeaderById(supabase, leaderId)
  if (!leader) {
    return { error: "Liderança não encontrada." }
  }
  if (!leader.user_id) {
    return {
      error:
        "Essa liderança ainda não tem acesso de login criado — crie o acesso primeiro em Configurações > Usuários.",
    }
  }

  const rawEmail = (formData.get("resend_email") as string | null)?.trim()
  const email = rawEmail || leader.email
  if (!email) {
    return { error: "Informe um e-mail para vincular o acesso." }
  }

  const channel = formData.get("resend_channel") === "whatsapp" ? "whatsapp" : "email"
  if (channel === "whatsapp" && !leader.phone) {
    return { error: "Essa liderança não tem WhatsApp cadastrado — informe o número no cadastro antes de reenviar por esse canal." }
  }

  const admin = createAdminClient()
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/redefinir-senha`

  // Corrigindo o e-mail digitado errado: o e-mail em auth.users é a fonte
  // da verdade de PRA ONDE o link de definir senha vai — leaders.email e
  // users_profiles.email são só espelho pra exibição/contato. Sem
  // atualizar os três juntos aqui, o reenvio continuaria saindo pro
  // endereço errado mesmo depois de "corrigir" só o cadastro.
  if (email !== leader.email) {
    const { error: updateAuthError } = await admin.auth.admin.updateUserById(leader.user_id, {
      email,
      email_confirm: false,
    })
    if (updateAuthError) {
      return { error: `Não foi possível atualizar o e-mail do acesso: ${updateAuthError.message}.` }
    }
    await admin.from("leaders").update({ email }).eq("id", leaderId)
    await admin.from("users_profiles").update({ email }).eq("id", leader.user_id)
  }

  if (channel === "whatsapp") {
    // Mesmo esquema do convite inicial (createLeaderAction acima), mas com
    // type "recovery" em vez de "invite": o usuário já existe (foi criado
    // no cadastro original), e "invite" só funciona pra usuário novo — pra
    // um que já existe ele falha com "already registered". "recovery" gera
    // o mesmo link de definir senha pra usuário existente, também sem
    // enviar nada sozinho.
    const { data: linked, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    })
    if (linkError || !linked.user) {
      return { error: `Não foi possível gerar o novo link de convite: ${linkError?.message ?? "erro desconhecido"}.` }
    }
    revalidatePath(`/liderancas/${leaderId}`)
    redirect(`/liderancas/${leaderId}?convite=whatsapp&link=${encodeURIComponent(linked.properties.action_link)}`)
  }

  // Canal e-mail: resetPasswordForEmail (client comum, não admin) dispara
  // e-mail de verdade pra um usuário que já existe — diferente de
  // generateLink, que só devolve o link sem enviar. É o mecanismo padrão
  // do Supabase pra "reenviar", já que inviteUserByEmail (usado no
  // cadastro original) só funciona pra usuário que ainda não existe.
  const { error: resendError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (resendError) {
    return { error: `Não foi possível reenviar o convite por e-mail: ${resendError.message}.` }
  }

  revalidatePath(`/liderancas/${leaderId}`)
  redirect(`/liderancas/${leaderId}?convite=enviado`)
}
