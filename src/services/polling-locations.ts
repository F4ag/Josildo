// Camada de acesso a dados eleitorais (electoral_zones/polling_locations/
// electoral_sections) — tabelas globais, sem organization_id (dado aberto do
// TSE, o mesmo pra qualquer cliente da plataforma, ver comentário em
// schema.sql), populadas pela Edge Function import-electoral-data. Usado
// para o autocomplete de "local de votação" nos cadastros de liderança/
// apoiador e para o relatório de expectativa x eleitorado por local.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type DB = SupabaseClient<Database, "public", any>

export type PollingLocationSuggestion = {
  id: string
  nome: string
  municipio_nome: string
  bairro: string | null
  zona_numero: number
  local_numero: number
  eleitores_total: number | null
}

/** PostgREST usa vírgula, ponto, parênteses, dois-pontos e espaço como
 * caracteres de controle da sintaxe de .or()/.ilike() — mesmo cuidado de
 * escapePostgrestValue em services/supporters.ts (duplicado aqui porque é
 * um arquivo de serviço independente, sem import cruzado entre domínios). */
function ilikeOrCondition(column: string, rawValue: string): string {
  const pattern = `%${rawValue}%`
  const needsQuoting = /[,.():"\\\s]/.test(pattern)
  const value = needsQuoting
    ? `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : pattern
  return `${column}.ilike.${value}`
}

/** Busca por nome do local, bairro ou município — usada pelo autocomplete
 * (server action em lib/actions/polling-locations.ts). Limite de 40: alto o
 * suficiente pra cobrir bairros densos (ex.: Rio Doce/Olinda tem 13 locais,
 * bairros maiores em Recife podem ter mais) sem cortar opções de verdade —
 * a lista já é rolável no componente (max-h-64 overflow-y-auto), e a query é
 * barata (índice em nome/bairro/município, tabela só do estado). Antes era
 * 8, e cortava silenciosamente bairros com mais de 8 locais.*/
export async function searchPollingLocations(supabase: DB, query: string): Promise<PollingLocationSuggestion[]> {
  const orConditions = [
    ilikeOrCondition("nome", query),
    ilikeOrCondition("municipio_nome", query),
    ilikeOrCondition("bairro", query),
  ].join(",")

  const { data, error } = await supabase
    .from("polling_locations")
    .select("id, nome, municipio_nome, bairro, zona_numero, local_numero, eleitores_total")
    .or(orConditions)
    .order("municipio_nome", { ascending: true })
    .order("nome", { ascending: true })
    .limit(40)

  if (error) throw new Error(`Falha ao buscar local de votação: ${error.message}`)
  return data
}

/** Formata o rótulo exibido pro usuário — usado tanto no autocomplete quanto
 * nas páginas de edição/detalhe (pra reconstruir o texto do local já salvo
 * a partir só do polling_location_id). */
export function formatPollingLocationLabel(loc: {
  nome: string
  bairro?: string | null
  municipio_nome: string
}): string {
  const local = [loc.bairro, loc.municipio_nome].filter(Boolean).join(", ")
  return local ? `${loc.nome} — ${local}` : loc.nome
}

/** Busca um único local pelo id — usado nas páginas de edição/detalhe de
 * liderança/apoiador pra mostrar o nome do local já vinculado (o registro
 * de leaders/supporters só guarda o id). */
export async function getPollingLocationById(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("polling_locations")
    .select("id, nome, municipio_nome, bairro, zona_numero, local_numero, eleitores_total")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Falha ao buscar local de votação: ${error.message}`)
  return data
}
