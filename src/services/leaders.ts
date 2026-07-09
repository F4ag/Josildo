// Camada de acesso a dados de Lideranças (Módulo 3).
// Recebe o client Supabase por parâmetro (em vez de criar um aqui dentro)
// para funcionar tanto em Server Components quanto em Server Actions, e
// para os testes poderem injetar um client fake sem mockar módulo.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { Leader, LeaderType, LeaderStatus, InfluenceLevel } from "@/types/domain"

type DB = SupabaseClient<Database>

export type LeaderFilters = {
  neighborhood?: string
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
  "id" | "created_at" | "updated_at" | "created_by"
>

export async function createLeader(supabase: DB, input: LeaderInput, createdBy: string) {
  const { data, error } = await supabase
    .from("leaders")
    .insert({ ...input, created_by: createdBy })
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

/** Distinct de bairros cadastrados em leaders — usado no filtro da listagem. */
export async function listDistinctLeaderNeighborhoods(supabase: DB) {
  const { data, error } = await supabase
    .from("leaders")
    .select("neighborhood")
    .not("neighborhood", "is", null)
  if (error) throw new Error(`Falha ao listar bairros: ${error.message}`)
  return Array.from(new Set(data.map((row) => row.neighborhood).filter(Boolean))) as string[]
}
