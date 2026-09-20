// Camada de acesso a `neighborhoods` — mesmo padrão de services/leaders.ts:
// recebe o client Supabase por parâmetro, sem filtrar organization_id à mão
// (a RLS já restringe select à organização do usuário logado — policy
// nb_select_all em supabase/rls_policies.sql).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { Neighborhood } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

export async function listNeighborhoods(supabase: DB): Promise<Neighborhood[]> {
  const { data, error } = await supabase
    .from("neighborhoods")
    .select("*")
    .order("name", { ascending: true })
  if (error) throw new Error(`Falha ao listar bairros: ${error.message}`)
  return data
}
