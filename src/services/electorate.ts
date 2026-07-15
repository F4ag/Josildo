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
//
// IMPORTANTE: polling_locations tem os ~1000+ locais de votação de PE
// inteiro (bem mais que as ~1000 linhas que o PostgREST devolve por
// consulta, por padrão) — por isso toda leitura aqui pagina em blocos de
// 1000 (fetchAllPollingLocations) até esgotar as linhas, senão cidades e
// locais do fim da lista somem silenciosamente do relatório.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type DB = SupabaseClient<Database, "public", any>

const PAGE_SIZE = 1000

/** Busca todas as linhas de polling_locations em blocos de PAGE_SIZE,
 * ordenando por "id" pra garantir paginação estável (sem pular nem repetir
 * linha entre páginas). `buildQuery` monta a query (com select/filtros já
 * aplicados) pra um intervalo [from, to] específico. */
async function fetchAllPollingLocations<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Falha ao consultar eleitorado: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

export async function listDistinctElectorateCities(supabase: DB): Promise<string[]> {
  const rows = await fetchAllPollingLocations<{ municipio_nome: string }>((from, to) =>
    supabase.from("polling_locations").select("municipio_nome").order("id").range(from, to),
  )
  return Array.from(new Set(rows.map((r) => r.municipio_nome))).sort((a, b) => a.localeCompare(b))
}

/** Bairros distintos, com o mesmo filtro em cascata por cidade dos outros
 * relatórios (listDistinctLeaderNeighborhoods etc). */
export async function listDistinctElectorateNeighborhoods(
  supabase: DB,
  filters?: { city?: string },
): Promise<string[]> {
  const rows = await fetchAllPollingLocations<{ bairro: string | null }>((from, to) => {
    let query = supabase.from("polling_locations").select("bairro").not("bairro", "is", null).order("id").range(from, to)
    if (filters?.city) query = query.eq("municipio_nome", filters.city)
    return query
  })
  return Array.from(new Set(rows.map((r) => r.bairro as string))).sort((a, b) => a.localeCompare(b))
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
  return fetchAllPollingLocations<{ municipio_nome: string; bairro: string | null; eleitores_total: number | null }>(
    (from, to) => {
      let query = supabase.from("polling_locations").select("municipio_nome, bairro, eleitores_total").order("id").range(from, to)
      if (filters?.city) query = query.eq("municipio_nome", filters.city)
      if (filters?.bairro) query = query.eq("bairro", filters.bairro)
      return query
    },
  )
}

// Ordenado em ordem alfabética (não por eleitorado) — é relatório de
// consulta, não ranking, então o importante é achar a cidade/bairro rápido.
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

  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label))
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

  return Array.from(groups.values()).sort((a, b) => {
    const cityCmp = (a.city ?? "").localeCompare(b.city ?? "")
    if (cityCmp !== 0) return cityCmp
    return a.label.localeCompare(b.label)
  })
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
 * com filtro em cascata cidade→bairro, em ordem alfabética (cidade, depois
 * nome do local). */
export async function getElectorateByPollingLocation(
  supabase: DB,
  filters?: { city?: string; bairro?: string },
): Promise<ElectorateLocationRow[]> {
  const rows = await fetchAllPollingLocations<{
    id: string
    nome: string
    municipio_nome: string
    bairro: string | null
    endereco: string | null
    eleitores_total: number | null
  }>((from, to) => {
    let query = supabase
      .from("polling_locations")
      .select("id, nome, municipio_nome, bairro, endereco, eleitores_total")
      .order("id")
      .range(from, to)
    if (filters?.city) query = query.eq("municipio_nome", filters.city)
    if (filters?.bairro) query = query.eq("bairro", filters.bairro)
    return query
  })

  return rows
    .map((r) => ({
      id: r.id,
      nome: r.nome,
      city: r.municipio_nome,
      bairro: r.bairro,
      endereco: r.endereco,
      eleitores: r.eleitores_total,
    }))
    .sort((a, b) => a.city.localeCompare(b.city) || a.nome.localeCompare(b.nome))
}
