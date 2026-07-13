// Camada de acesso a dados de Lideranças (Módulo 3).
// Recebe o client Supabase por parâmetro (em vez de criar um aqui dentro)
// para funcionar tanto em Server Components quanto em Server Actions, e
// para os testes poderem injetar um client fake sem mockar módulo.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { Leader, LeaderType, LeaderStatus, InfluenceLevel } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

export type LeaderFilters = {
  neighborhood?: string
  city?: string
  leaderType?: LeaderType
  status?: LeaderStatus
  influenceLevel?: InfluenceLevel
  /** Restringe à rede de uma liderança específica — usado quando quem está
   * chamando é a própria liderança (a RLS já filtra, mas isso evita pedir
   * linhas que o Postgres vai descartar mesmo assim). */
  onlyLeaderId?: string
  search?: string
}

export async function listLeaders(supabase: DB, filters: LeaderFilters = {}) {
  let query = supabase.from("leaders").select("*").order("name", { ascending: true })

  if (filters.onlyLeaderId) query = query.eq("id", filters.onlyLeaderId)
  if (filters.neighborhood) query = query.eq("neighborhood", filters.neighborhood)
  if (filters.city) query = query.eq("city", filters.city)
  if (filters.leaderType) query = query.eq("leader_type", filters.leaderType)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.influenceLevel) query = query.eq("influence_level", filters.influenceLevel)
  if (filters.search) query = query.ilike("name", `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar lideranças: ${error.message}`)
  return data
}

export async function getLeaderById(supabase: DB, id: string): Promise<Leader | null> {
  const { data, error } = await supabase.from("leaders").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`Falha ao buscar liderança: ${error.message}`)
  return data
}

/** Lideranças ainda sem login vinculado — usado no cadastro de usuários. */
export async function listLeadersWithoutAccount(supabase: DB) {
  const { data, error } = await supabase
    .from("leaders")
    .select("id, name, neighborhood")
    .is("user_id", null)
    .order("name", { ascending: true })
  if (error) throw new Error(`Falha ao listar lideranças sem conta: ${error.message}`)
  return data
}

export type LeaderInput = Omit<
  Database["public"]["Tables"]["leaders"]["Insert"],
  "id" | "created_at" | "updated_at" | "created_by" | "organization_id"
>

export async function createLeader(supabase: DB, input: LeaderInput, createdBy: string, organizationId: string) {
  const { data, error } = await supabase
    .from("leaders")
    .insert({ ...input, created_by: createdBy, organization_id: organizationId })
    .select()
    .single()
  if (error) throw new Error(`Falha ao cadastrar liderança: ${error.message}`)
  return data
}

export async function updateLeader(supabase: DB, id: string, input: Partial<LeaderInput>) {
  const { data, error } = await supabase
    .from("leaders")
    .update(input)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(`Falha ao atualizar liderança: ${error.message}`)
  return data
}

/**
 * Exclui a liderança. Reservado a admin_geral (RLS: policy ld_admin_geral_all
 * é a única que cobre "for all", incluindo delete — ver rls_policies.sql).
 * Não há ON DELETE CASCADE/SET NULL em leader_id nas tabelas dependentes
 * (supporters, demands, attendances, agenda_events, users_profiles) —
 * de propósito, para não apagar em cascata dado de eleitor/histórico. Se
 * houver algum vínculo, o Postgres recusa com um erro de foreign key, que
 * aqui vira uma mensagem legível em vez do código do Postgres.
 */
export async function deleteLeader(supabase: DB, id: string) {
  const { error } = await supabase.from("leaders").delete().eq("id", id)
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "Não é possível excluir: essa liderança ainda tem apoiadores, demandas ou outros registros vinculados. Transfira ou remova esses vínculos antes de excluir.",
      )
    }
    throw new Error(`Falha ao excluir liderança: ${error.message}`)
  }
}

export type LeaderStatusCounts = {
  total: number
  ativa: number
  em_atencao: number
  inativa: number
  estrategica: number
}

/** Contagem por status pra os cards de resumo no topo de /liderancas — não
 * é afetada pelos filtros da tela (mostra o total real da rede, a pessoa
 * usa os filtros pra explorar a tabela abaixo). Traz só a coluna "status"
 * (não a linha inteira) porque aqui só interessa contar. */
export async function getLeaderStatusCounts(supabase: DB): Promise<LeaderStatusCounts> {
  const { data, error } = await supabase.from("leaders").select("status")
  if (error) throw new Error(`Falha ao contar lideranças: ${error.message}`)

  const counts: LeaderStatusCounts = { total: data.length, ativa: 0, em_atencao: 0, inativa: 0, estrategica: 0 }
  for (const row of data) {
    const status = row.status as LeaderStatus
    if (status === "ativa") counts.ativa++
    else if (status === "em_atencao") counts.em_atencao++
    else if (status === "inativa") counts.inativa++
    else if (status === "estrategica") counts.estrategica++
  }
  return counts
}

/** Distinct de bairros cadastrados em leaders — usado no filtro da listagem. */
export async function listDistinctLeaderNeighborhoods(supabase: DB) {
  const { data, error } = await supabase
    .from("leaders")
    .select("neighborhood")
    .not("neighborhood", "is", null)
  if (error) throw new Error(`Falha ao listar bairros: ${error.message}`)
  return Array.from(new Set(data.map((row) => row.neighborhood).filter(Boolean))) as string[]
}

/** Distinct de cidades cadastradas em leaders — usado no filtro da listagem. */
export async function listDistinctLeaderCities(supabase: DB) {
  const { data, error } = await supabase
    .from("leaders")
    .select("city")
    .not("city", "is", null)
  if (error) throw new Error(`Falha ao listar cidades: ${error.message}`)
  return Array.from(new Set(data.map((row) => row.city).filter(Boolean))) as string[]
}
