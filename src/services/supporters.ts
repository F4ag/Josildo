// Camada de acesso a dados de Apoiadores (Módulo 4).
// Mesmo padrão de services/leaders.ts: recebe o client Supabase por parâmetro.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { Supporter, SupporterOrigin } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

export type SupporterFilters = {
  neighborhood?: string
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
  "id" | "created_at" | "updated_at" | "created_by"
>

/**
 * Detector de duplicidade (Módulo 4 / 16): telefone, nome+nascimento ou
 * nome+endereço batendo com um registro já existente. Retorna os
 * candidatos encontrados — quem decide se cadastra mesmo assim é o
 * formulário (com justificativa), nunca esta função.
 */
export async function findPotentialDuplicates(
  supabase: DB,
  input: Pick<SupporterInput, "phone" | "name" | "birth_date" | "address">,
) {
  const orConditions = [
    `phone.eq.${input.phone}`,
    `and(name.eq.${input.name},birth_date.eq.${input.birth_date})`,
    `and(name.eq.${input.name},address.eq.${input.address})`,
  ].join(",")

  const { data, error } = await supabase
    .from("supporters")
    .select("id, name, phone, birth_date, address, neighborhood")
    .or(orConditions)
    .limit(5)

  if (error) throw new Error(`Falha ao checar duplicidade: ${error.message}`)
  return data
}

export async function createSupporter(supabase: DB, input: SupporterInput, createdBy: string) {
  const { data, error } = await supabase
    .from("supporters")
    .insert({ ...input, created_by: createdBy })
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

export async function listDistinctSupporterNeighborhoods(supabase: DB) {
  const { data, error } = await supabase
    .from("supporters")
    .select("neighborhood")
    .not("neighborhood", "is", null)
  if (error) throw new Error(`Falha ao listar bairros: ${error.message}`)
  return Array.from(new Set(data.map((row) => row.neighborhood).filter(Boolean))) as string[]
}
