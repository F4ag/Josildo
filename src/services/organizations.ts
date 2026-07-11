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
