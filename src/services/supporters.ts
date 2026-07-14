// Camada de acesso a dados de Apoiadores (Módulo 4).
// Mesmo padrão de services/leaders.ts: recebe o client Supabase por parâmetro.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { Supporter, SupporterOrigin } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

export type SupporterFilters = {
  neighborhood?: string
  city?: string
  leaderId?: string
  origin?: SupporterOrigin
  /** Aniversariantes de um mês específico (1-12) — usado no Módulo 9. */
  birthMonth?: number
  search?: string
}

// Ver nota equivalente em services/attendances.ts sobre o cast de relações
// embutidas (leaders) por causa do schema "any" do client.
export type SupporterWithLeader = Supporter & {
  leaders: { name: string } | null
}

export async function listSupporters(supabase: DB, filters: SupporterFilters = {}) {
  let query = supabase.from("supporters").select("*, leaders(name)").order("name", { ascending: true })

  if (filters.neighborhood) query = query.eq("neighborhood", filters.neighborhood)
  if (filters.city) query = query.eq("city", filters.city)
  if (filters.leaderId) query = query.eq("leader_id", filters.leaderId)
  if (filters.origin) query = query.eq("origin", filters.origin)
  if (filters.search) query = query.ilike("name", `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar apoiadores: ${error.message}`)
  const rows = data as unknown as SupporterWithLeader[]

  if (filters.birthMonth) {
    return rows.filter((s) => new Date(`${s.birth_date}T00:00:00`).getMonth() + 1 === filters.birthMonth)
  }
  return rows
}

export async function getSupporterById(supabase: DB, id: string): Promise<Supporter | null> {
  const { data, error } = await supabase.from("supporters").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`Falha ao buscar apoiador: ${error.message}`)
  return data
}

export type SupporterInput = Omit<
  Database["public"]["Tables"]["supporters"]["Insert"],
  "id" | "created_at" | "updated_at" | "created_by" | "organization_id"
>

/**
 * Detector de duplicidade (Módulo 4 / 16): telefone, nome+nascimento ou
 * nome+endereço batendo com um registro já existente. Retorna os
 * candidatos encontrados — quem decide se cadastra mesmo assim é o
 * formulário (com justificativa), nunca esta função.
 */
// O filtro .or() do PostgREST usa vírgula, ponto e parênteses como
// caracteres de controle da sintaxe (ex.: "and(a.eq.1,b.eq.2)"). Nome e
// endereço digitados por um usuário quase sempre têm vírgula ("Rua Tal,
// 123") ou ponto — sem escapar, o valor quebra a sintaxe do filtro e o
// PostgREST responde com "failed to parse the tree" (500), derrubando a
// tela inteira de cadastro de apoiador. A regra do PostgREST é envolver em
// aspas duplas qualquer valor que contenha , . ( ) : " ou espaço, escapando
// aspas/barras internas.
function escapePostgrestValue(value: string): string {
  if (/[,.():"\\\s]/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  }
  return value
}

export async function findPotentialDuplicates(
  supabase: DB,
  input: Pick<SupporterInput, "phone" | "name" | "birth_date" | "address">,
) {
  const phone = escapePostgrestValue(input.phone)
  const name = escapePostgrestValue(input.name)
  const birthDate = escapePostgrestValue(input.birth_date)
  const address = escapePostgrestValue(input.address)

  const orConditions = [
    `phone.eq.${phone}`,
    `and(name.eq.${name},birth_date.eq.${birthDate})`,
    `and(name.eq.${name},address.eq.${address})`,
  ].join(",")

  const { data, error } = await supabase
    .from("supporters")
    .select("id, name, phone, birth_date, address, neighborhood")
    .or(orConditions)
    .limit(5)

  if (error) throw new Error(`Falha ao checar duplicidade: ${error.message}`)
  return data
}

export async function createSupporter(supabase: DB, input: SupporterInput, createdBy: string, organizationId: string) {
  const { data, error } = await supabase
    .from("supporters")
    .insert({ ...input, created_by: createdBy, organization_id: organizationId })
    .select()
    .single()
  if (error) throw new Error(`Falha ao cadastrar apoiador: ${error.message}`)
  return data
}

export async function updateSupporter(supabase: DB, id: string, input: Partial<SupporterInput>) {
  const { data, error } = await supabase
    .from("supporters")
    .update(input)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(`Falha ao atualizar apoiador: ${error.message}`)
  return data
}

/**
 * Exclui o apoiador. Reservado a admin_geral (RLS: policy sp_admin_geral_all
 * é a única que cobre "for all", incluindo delete — ver rls_policies.sql).
 * Sem ON DELETE CASCADE em supporter_id nas tabelas dependentes (demands,
 * attendances, agenda_events) de propósito — não apagar em cascata
 * histórico de demanda/atendimento. Erro de foreign key vira mensagem
 * legível (mesmo tratamento de services/leaders.ts).
 */
export async function deleteSupporter(supabase: DB, id: string) {
  const { error } = await supabase.from("supporters").delete().eq("id", id)
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "Não é possível excluir: esse apoiador ainda tem demandas, atendimentos ou outros registros vinculados. Remova esses vínculos antes de excluir.",
      )
    }
    throw new Error(`Falha ao excluir apoiador: ${error.message}`)
  }
}

export async function listDistinctSupporterNeighborhoods(supabase: DB, filters?: { city?: string }) {
  let query = supabase.from("supporters").select("neighborhood").not("neighborhood", "is", null)
  if (filters?.city) query = query.eq("city", filters.city)
  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar bairros: ${error.message}`)
  return Array.from(new Set(data.map((row) => row.neighborhood).filter(Boolean))) as string[]
}

export async function listDistinctSupporterCities(supabase: DB) {
  const { data, error } = await supabase
    .from("supporters")
    .select("city")
    .not("city", "is", null)
  if (error) throw new Error(`Falha ao listar cidades: ${error.message}`)
  return Array.from(new Set(data.map((row) => row.city).filter(Boolean))) as string[]
}

export type SupporterStats = {
  total: number
  comWhatsapp: number
  comEmail: number
  novosMes: number
}

/** Contagens pros cards de resumo no topo de /apoiadores — não é afetada
 * pelos filtros da tela, mesma lógica de getLeaderStatusCounts em
 * services/leaders.ts. */
export async function getSupporterStats(supabase: DB): Promise<SupporterStats> {
  const { data, error } = await supabase
    .from("supporters")
    .select("consent_whatsapp, consent_email, created_at")
  if (error) throw new Error(`Falha ao contar apoiadores: ${error.message}`)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  let comWhatsapp = 0
  let comEmail = 0
  let novosMes = 0
  for (const row of data) {
    if (row.consent_whatsapp) comWhatsapp++
    if (row.consent_email) comEmail++
    if (row.created_at && new Date(row.created_at) >= startOfMonth) novosMes++
  }
  return { total: data.length, comWhatsapp, comEmail, novosMes }
}
