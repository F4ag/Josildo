// src/services/leader-access.ts
//
// Backend do acesso de liderança por link (sem senha) — ver
// docs/08-acesso-lideranca-sem-senha.md. Recebe o client ADMIN (service
// role) por parâmetro, igual services/organizations.ts: criar/banir login de
// outra pessoa exige ignorar RLS de propósito.

import "server-only"
import { randomBytes } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type AdminDB = SupabaseClient<Database, "public", any>

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lideramais.app.br"

/** 32 bytes aleatórios em base64url — só caracteres seguros pra URL, sem
 * padding. Espaço grande o bastante pra não ser adivinhável por força bruta
 * (ver docs/08-acesso-lideranca-sem-senha.md §8). */
export function generateAccessToken(): string {
  return randomBytes(32).toString("base64url")
}

/** E-mail interno, nunca exibido nem usado pra mandar e-mail de verdade —
 * só existe pra satisfazer a exigência do Supabase Auth de um identificador
 * único por login, quando a liderança não tem e-mail cadastrado. */
function buildSyntheticEmail(leaderId: string): string {
  return `lideranca-${leaderId}@interno.${ROOT_DOMAIN}`
}

export type LeaderForAccess = {
  id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
}

/**
 * Garante que exista um login (auth.users + users_profiles) por trás desta
 * liderança, criando um novo se `leader.user_id` ainda for null. Nunca envia
 * e-mail (usa createUser, não inviteUserByEmail/generateLink) — o acesso é
 * só pelo link, o login por trás é um detalhe interno.
 */
export async function ensureLeaderLogin(
  admin: AdminDB,
  leader: LeaderForAccess,
  organizationId: string,
): Promise<{ userId: string; email: string }> {
  if (leader.user_id) {
    const { data, error } = await admin.auth.admin.getUserById(leader.user_id)
    if (error || !data.user?.email) {
      throw new Error(`Falha ao buscar o login existente da liderança: ${error?.message ?? "e-mail ausente"}.`)
    }
    return { userId: leader.user_id, email: data.user.email }
  }

  const email = leader.email || buildSyntheticEmail(leader.id)

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new Error(`Falha ao criar o login da liderança: ${createError?.message ?? "erro desconhecido"}.`)
  }

  const { error: profileError } = await admin.from("users_profiles").insert({
    id: created.user.id,
    organization_id: organizationId,
    full_name: leader.name,
    email,
    phone: leader.phone,
    role: "lideranca",
    leader_id: leader.id,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw new Error(`Falha ao salvar o perfil da liderança: ${profileError.message}.`)
  }

  const { error: linkError } = await admin.from("leaders").update({ user_id: created.user.id }).eq("id", leader.id)
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw new Error(`Falha ao vincular o login à liderança: ${linkError.message}.`)
  }

  return { userId: created.user.id, email }
}

/**
 * Gera (ou substitui) o token de acesso da liderança, garantindo o login por
 * trás primeiro. Se o acesso tinha sido revogado (login banido), remove o
 * banimento — gerar um link novo sempre reabre o acesso.
 */
export async function generateLeaderAccessToken(
  admin: AdminDB,
  leader: LeaderForAccess,
  organizationId: string,
): Promise<string> {
  const { userId } = await ensureLeaderLogin(admin, leader, organizationId)

  const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" })
  if (unbanError) {
    throw new Error(`Falha ao reabilitar o login da liderança: ${unbanError.message}.`)
  }

  const token = generateAccessToken()
  const { error } = await admin.from("leaders").update({ access_token: token }).eq("id", leader.id)
  if (error) throw new Error(`Falha ao salvar o link de acesso: ${error.message}.`)

  return token
}

/**
 * Revoga o link de acesso: apaga o token (nenhum link antigo funciona mais)
 * e bane o login por trás. Banir não mata instantaneamente uma sessão já
 * aberta (o token de acesso em uso continua criptograficamente válido até
 * expirar sozinho), mas impede qualquer renovação futura — na prática a
 * sessão morre dentro do tempo de vida do token de acesso do Supabase (ver
 * docs/08-acesso-lideranca-sem-senha.md §8). "876000h" (~100 anos) é o valor
 * idiomático do Supabase pra "banido permanentemente".
 */
export async function revokeLeaderAccess(admin: AdminDB, leaderId: string, userId: string | null): Promise<void> {
  const { error } = await admin.from("leaders").update({ access_token: null }).eq("id", leaderId)
  if (error) throw new Error(`Falha ao revogar o link de acesso: ${error.message}.`)

  if (userId) {
    const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" })
    if (banError) throw new Error(`Falha ao bloquear o login da liderança: ${banError.message}.`)
  }
}

export function buildLeaderAccessLink(host: string, token: string): string {
  return `https://${host}/acesso-lideranca/${token}`
}
