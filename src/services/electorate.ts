// Consulta de eleitorado — relatório à parte de "Expectativa de votos"
// (/relatorios/votos), pedido explícito da Agência F4 depois de ver a coluna
// "Eleitorado (TSE)" naquele relatório. Aqui não cruza nada com
// lideranças/apoiadores: é só a própria tabela polling_locations (dado
// aberto do TSE, ver schema.sql), pra consulta livre — quantos eleitores
// existem em cada cidade/bairro/local de votação, com filtro em cascata e
// impressão/PDF, igual aos outros relatórios.
//
// Por isso fica em services/electorate.ts (não em services/reports.ts):
// não depende de organization_id nem de nenhuma tabela multi-tenant, só de
// polling_locations, que é dado geográfico compartilhado por qualquer
// organização.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type DB = SupabaseClient<Database, "public", any>

export async function listDistinctElectorateCities(supabase: DB): Promise<string[]> {
  const { data, error } = await supabase.from("polling_locations").select("municipio_nome")
  if (error) throw new Error(`Falha ao listar cidades do eleitorado: ${error.message}`)
  return Array.from(new Set((data ?? []).map((r) => r.municipio_nome))).sort((a, b) => a.localeCompare(b))
}

/** Bairros distintos, com o mesmo filtro em cascata por cidade dos outros
 * relatórios (listDistinctLeaderNeighborhoods etc). */
export async function listDistinctElectorateNeighborhoods(
  supabase: DB,
  filters?: { city?: string },
): Promise<string[]> {
  let query = supabase.from("polling_locations").select("bairro").not("bairro", "is", null)
  if (filters?.city) query = query.eq("municipio_nome", filters.city)
  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar bairros do eleitorado: ${error.message}`)
  return Array.from(new Set((data ?? []).map((r) => r.bairro as string))).sort((a, b) => a.localeCompare(b))
}

export type ElectorateByGroupRow = {
  /** Nome da cidade (getElectorateByCity) ou do bairro (getElectorateByNeighborhood). */
  label: string
  /** Só preenchido em getElectorateByNeighborhood, pra mostrar a cidade ao lado. */
  city?: string | null
  locationCount: number
  eleitores: number
}

async function listElectorateRows(supabase: DB, filters?: { city?: string; bairro?: string }) {
  let query = supabase.from("polling_locations").select("municipio_nome, bairro, eleitores_total")
  if (filters?.city) query = query.eq("municipio_nome", filters.city)
  if (filters?.bairro) query = query.eq("bairro", filters.bairro)
  const { data, error } = await query
  if (error) throw new Error(`Falha ao consultar eleitorado: ${error.message}`)
  return data ?? []
}

export async function getElectorateByCity(supabase: DB, filters?: { city?: string }): Promise<ElectorateByGroupRow[]> {
  const rows = await listElectorateRows(supabase, filters)
  const groups = new Map<string, ElectorateByGroupRow>()

  for (const row of rows) {
    const key = row.municipio_nome
    const current = groups.get(key) ?? { label: key, locationCount: 0, eleitores: 0 }
    current.locationCount += 1
    current.eleitores += row.eleitores_total ?? 0
    groups.set(key, current)
  }

  return Array.from(groups.values()).sort((a, b) => b.eleitores - a.eleitores)
}

export async function getElectorateByNeighborhood(
  supabase: DB,
  filters?: { city?: string; bairro?: string },
): Promise<ElectorateByGroupRow[]> {
  const rows = await listElectorateRows(supabase, filters)
  const groups = new Map<string, ElectorateByGroupRow>()

  for (const row of rows) {
    const bairroLabel = row.bairro ?? "Sem bairro"
    const key = `${row.municipio_nome}::${bairroLabel}`
    const current = groups.get(key) ?? {
      label: bairroLabel,
      city: row.municipio_nome,
      locationCount: 0,
      eleitores: 0,
    }
    current.locationCount += 1
    current.eleitores += row.eleitores_total ?? 0
    groups.set(key, current)
  }

  return Array.from(groups.values()).sort((a, b) => b.eleitores - a.eleitores)
}

export type ElectorateLocationRow = {
  id: string
  nome: string
  city: string
  bairro: string | null
  endereco: string | null
  eleitores: number | null
}

/** Lista (não agrega — já é o nível mais granular) os locais de votação,
 * com filtro em cascata cidade→bairro. */
export async function getElectorateByPollingLocation(
  supabase: DB,
  filters?: { city?: string; bairro?: string },
): Promise<ElectorateLocationRow[]> {
  let query = supabase
    .from("polling_locations")
    .select("id, nome, municipio_nome, bairro, endereco, eleitores_total")
    .order("municipio_nome", { ascending: true })
    .order("nome", { ascending: true })
  if (filters?.city) query = query.eq("municipio_nome", filters.city)
  if (filters?.bairro) query = query.eq("bairro", filters.bairro)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao consultar eleitorado por local de votação: ${error.message}`)

  return (data ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    city: r.municipio_nome,
    bairro: r.bairro,
    endereco: r.endereco,
    eleitores: r.eleitores_total,
  }))
}
