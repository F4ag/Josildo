// Camada de acesso a `organizations` — usada SÓ pelo painel de provisionamento
// de clientes (is_platform_admin), por isso todas as funções aqui recebem
// obrigatoriamente o client ADMIN (service role), não o client normal do
// usuário logado: a RLS de organizations (policy org_select_own) restringe
// select a UMA linha só (a do próprio usuário), então listar/criar outras
// organizações exige ignorar RLS de propósito — a barreira de segurança real
// é o assertPlatformAdmin() chamado antes, em app/(app)/clientes/actions.ts.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type AdminDB = SupabaseClient<Database, "public", any>

export type OrganizationWithAdmin = {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  created_at: string
  admin_email: string | null
  admin_status: string | null
}

/** Lista todas as organizações + o e-mail/status do respectivo admin_geral
 * (pra mostrar na tela quem é o responsável de cada cliente). */
export async function listOrganizationsWithAdmin(admin: AdminDB): Promise<OrganizationWithAdmin[]> {
  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .select("id, name, slug, status, plan, created_at")
    .order("created_at", { ascending: false })
  if (orgsError) throw new Error(`Falha ao listar organizações: ${orgsError.message}`)

  const { data: admins, error: adminsError } = await admin
    .from("users_profiles")
    .select("organization_id, email, status")
    .eq("role", "admin_geral")
  if (adminsError) throw new Error(`Falha ao listar admins: ${adminsError.message}`)

  const adminByOrg = new Map(admins.map((a) => [a.organization_id, a]))

  return orgs.map((org) => {
    const orgAdmin = adminByOrg.get(org.id)
    return {
      ...org,
      admin_email: orgAdmin?.email ?? null,
      admin_status: orgAdmin?.status ?? null,
    }
  })
}

export async function isSlugTaken(admin: AdminDB, slug: string): Promise<boolean> {
  const { data, error } = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle()
  if (error) throw new Error(`Falha ao checar subdomínio: ${error.message}`)
  return data !== null
}

export async function isEmailTaken(admin: AdminDB, email: string): Promise<boolean> {
  const { data, error } = await admin.from("users_profiles").select("id").eq("email", email).maybeSingle()
  if (error) throw new Error(`Falha ao checar e-mail: ${error.message}`)
  return data !== null
}

export async function createOrganizationRow(admin: AdminDB, name: string, slug: string) {
  const { data, error } = await admin
    .from("organizations")
    .insert({ name, slug })
    .select()
    .single()
  if (error) throw new Error(`Falha ao criar organização: ${error.message}`)
  return data
}

export async function getOrganizationById(admin: AdminDB, id: string) {
  const { data, error } = await admin.from("organizations").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`Falha ao buscar organização: ${error.message}`)
  return data
}

export type OrganizationUpdateInput = { name: string; slug: string; status: string; plan: string }

export async function updateOrganizationRow(admin: AdminDB, id: string, input: OrganizationUpdateInput) {
  const { data, error } = await admin
    .from("organizations")
    .update(input)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(`Falha ao atualizar organização: ${error.message}`)
  return data
}

/**
 * Apaga uma organização inteira e TUDO que pertence a ela — sem volta.
 * Reservado ao painel /clientes (is_platform_admin), chamado por
 * app/(app)/clientes/actions.ts::deleteClientAction, que já bloqueia a
 * organização raiz (lidera-mais) e a própria organização de quem está
 * logado antes de chegar aqui.
 *
 * Ordem de exclusão (respeitando as FKs — ver supabase/schema.sql):
 * 1) users_profiles.leader_id é zerado primeiro pra quebrar a referência
 *    circular leaders.user_id <-> users_profiles.leader_id (as duas são
 *    "NO ACTION", cada uma bloqueia apagar a outra enquanto aponta pra ela).
 * 2) agenda_events antes de attendances/demands (referencia as duas).
 * 3) attendances e demands antes de leaders/supporters (demand_updates cai
 *    em cascata junto com demands, já é "ON DELETE CASCADE").
 * 4) interactions/notifications/attachments/message_templates não têm nada
 *    dependendo delas, só precisam sair antes de leaders/users_profiles.
 * 5) supporters antes de leaders (supporters.leader_id).
 * 6) leaders antes de neighborhoods (leaders.neighborhood_id).
 * 7) por fim, os logins (auth.users) — apagar por lá em vez de
 *    users_profiles direto porque users_profiles_id_fkey já é "ON DELETE
 *    CASCADE" a partir de auth.users, então isso também limpa o perfil.
 */
export async function deleteOrganizationCascade(admin: AdminDB, organizationId: string) {
  const { data: profiles, error: profilesError } = await admin
    .from("users_profiles")
    .select("id")
    .eq("organization_id", organizationId)
  if (profilesError) throw new Error(`Falha ao listar usuários da organização: ${profilesError.message}`)

  const { error: unlinkError } = await admin
    .from("users_profiles")
    .update({ leader_id: null })
    .eq("organization_id", organizationId)
  if (unlinkError) throw new Error(`Falha ao desvincular usuários de lideranças: ${unlinkError.message}`)

  const tablesInOrder = [
    "agenda_events",
    "attendances",
    "demands",
    "interactions",
    "notifications",
    "attachments",
    "message_templates",
    "supporters",
    "leaders",
    "neighborhoods",
  ] as const

  for (const table of tablesInOrder) {
    const { error } = await admin.from(table).delete().eq("organization_id", organizationId)
    if (error) throw new Error(`Falha ao apagar "${table}" da organização: ${error.message}`)
  }

  for (const profile of profiles ?? []) {
    // Cascata (users_profiles_id_fkey ON DELETE CASCADE) já apaga a linha
    // de users_profiles junto — não precisa (nem deve) apagar as duas.
    const { error } = await admin.auth.admin.deleteUser(profile.id)
    if (error) throw new Error(`Falha ao excluir usuário ${profile.id}: ${error.message}`)
  }

  const { error: orgError } = await admin.from("organizations").delete().eq("id", organizationId)
  if (orgError) throw new Error(`Falha ao excluir organização: ${orgError.message}`)
}
