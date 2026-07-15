// Relatórios do Módulo 11. Só os dois do MVP (§12 do prompt master):
// 11.1 Lideranças por bairro e 11.5 Pessoas atendidas. Os demais (11.2 a
// 11.4, 11.6, 11.7 — crescimento, ranking, bairros fracos) ficam para a v2,
// quando houver histórico suficiente para os indicadores fazerem sentido.
//
// Todas as agregações são feitas com poucas queries em lote (uma por
// tabela) e agrupadas em memória — evita N+1 (uma query por liderança).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { listPessoasAtendidas } from "./pessoas-atendidas"
import { listDistinctLeaderCities, listDistinctLeaderNeighborhoods } from "./leaders"
import { listDistinctSupporterCities, listDistinctSupporterNeighborhoods } from "./supporters"

type DB = SupabaseClient<Database, "public", any>

// ----------------------------------------------------------------------------
// 11.1 — Lideranças por bairro
// ----------------------------------------------------------------------------
export type LeaderReportRow = {
  id: string
  neighborhood: string | null
  city: string | null
  name: string
  phone: string | null
  status: string
  supporterCount: number
  demandCount: number
  demandResolvedCount: number
  attendanceCount: number
  lastInteractionAt: string | null
}

export async function getLeadersByNeighborhoodReport(
  supabase: DB,
  filters?: { city?: string; neighborhood?: string; sortBy?: "neighborhood" | "city" },
): Promise<LeaderReportRow[]> {
  let leadersQuery = supabase.from("leaders").select("id, name, phone, neighborhood, city, status").order(filters?.sortBy ?? "neighborhood", { ascending: true })
  if (filters?.city) leadersQuery = leadersQuery.eq("city", filters.city)
  if (filters?.neighborhood) leadersQuery = leadersQuery.eq("neighborhood", filters.neighborhood)

  const [{ data: leaders, error: leadersError }, { data: supporters }, { data: demands }, { data: attendances }, { data: interactions }] =
    await Promise.all([
      leadersQuery,
      supabase.from("supporters").select("leader_id").not("leader_id", "is", null),
      supabase.from("demands").select("leader_id, status").not("leader_id", "is", null),
      supabase.from("attendances").select("leader_id").not("leader_id", "is", null),
      supabase.from("interactions").select("leader_id, created_at").not("leader_id", "is", null),
    ])

  if (leadersError) throw new Error(`Falha ao gerar relatório de lideranças: ${leadersError.message}`)

  const supporterCounts = countBy(supporters ?? [], "leader_id")
  const demandCounts = countBy(demands ?? [], "leader_id")
  const demandResolvedCounts = countBy((demands ?? []).filter((d) => d.status === "resolvida"), "leader_id")
  const attendanceCounts = countBy(attendances ?? [], "leader_id")
  const lastInteraction = maxDateBy(interactions ?? [], "leader_id")

  return leaders.map((leader) => ({
    id: leader.id,
    neighborhood: leader.neighborhood,
    city: leader.city,
    name: leader.name,
    phone: leader.phone,
    status: leader.status,
    supporterCount: supporterCounts.get(leader.id) ?? 0,
    demandCount: demandCounts.get(leader.id) ?? 0,
    demandResolvedCount: demandResolvedCounts.get(leader.id) ?? 0,
    attendanceCount: attendanceCounts.get(leader.id) ?? 0,
    lastInteractionAt: lastInteraction.get(leader.id) ?? null,
  }))
}

// ----------------------------------------------------------------------------
// 11.5 — Pessoas atendidas
// ----------------------------------------------------------------------------
export type PessoaAtendidaReportRow = {
  id: string
  name: string
  neighborhood: string | null
  city: string | null
  leaderName: string | null
  demandCount: number
  demandResolvedCount: number
  attendanceCount: number
  attendanceConcludedCount: number
}

export async function getPessoasAtendidasReport(
  supabase: DB,
  filters?: { city?: string; neighborhood?: string },
): Promise<PessoaAtendidaReportRow[]> {
  const [pessoas, { data: demands }, { data: attendances }] = await Promise.all([
    listPessoasAtendidas(supabase, filters),
    supabase.from("demands").select("supporter_id, status").not("supporter_id", "is", null),
    supabase.from("attendances").select("supporter_id, status"),
  ])

  const demandCounts = countBy(demands ?? [], "supporter_id")
  const demandResolvedCounts = countBy((demands ?? []).filter((d) => d.status === "resolvida"), "supporter_id")
  const attendanceCounts = countBy(attendances ?? [], "supporter_id")
  const attendanceConcludedCounts = countBy((attendances ?? []).filter((a) => a.status === "atendido"), "supporter_id")

  return pessoas.map((p) => ({
    id: p.id,
    name: p.name,
    neighborhood: p.neighborhood,
    city: p.city,
    leaderName: p.leaders?.name ?? null,
    demandCount: demandCounts.get(p.id) ?? 0,
    demandResolvedCount: demandResolvedCounts.get(p.id) ?? 0,
    attendanceCount: attendanceCounts.get(p.id) ?? 0,
    attendanceConcludedCount: attendanceConcludedCounts.get(p.id) ?? 0,
  }))
}

// ----------------------------------------------------------------------------
// Relatório geral — Todos os cadastros (lideranças + apoiadores juntos)
// ----------------------------------------------------------------------------
export type AllRegistrationRow = {
  id: string
  kind: "lideranca" | "apoiador"
  name: string
  neighborhood: string | null
  city: string | null
  phone: string | null
  /** Só preenchido pra apoiador: nome da liderança à qual está vinculado. */
  leaderName: string | null
}

export async function getAllRegistrationsReport(
  supabase: DB,
  filters?: { city?: string; neighborhood?: string },
): Promise<AllRegistrationRow[]> {
  let leadersQuery = supabase.from("leaders").select("id, name, phone, neighborhood, city").order("name", { ascending: true })
  let supportersQuery = supabase.from("supporters").select("id, name, phone, neighborhood, city, leaders(name)").order("name", { ascending: true })

  if (filters?.city) {
    leadersQuery = leadersQuery.eq("city", filters.city)
    supportersQuery = supportersQuery.eq("city", filters.city)
  }
  if (filters?.neighborhood) {
    leadersQuery = leadersQuery.eq("neighborhood", filters.neighborhood)
    supportersQuery = supportersQuery.eq("neighborhood", filters.neighborhood)
  }

  const [{ data: leaders, error: leadersError }, { data: supporters, error: supportersError }] = await Promise.all([
    leadersQuery,
    supportersQuery,
  ])
  if (leadersError) throw new Error(`Falha ao gerar relatório geral (lideranças): ${leadersError.message}`)
  if (supportersError) throw new Error(`Falha ao gerar relatório geral (apoiadores): ${supportersError.message}`)

  const leaderRows: AllRegistrationRow[] = (leaders ?? []).map((l) => ({
    id: l.id,
    kind: "lideranca",
    name: l.name,
    neighborhood: l.neighborhood,
    city: l.city,
    phone: l.phone,
    leaderName: null,
  }))
  const supporterRows: AllRegistrationRow[] = (supporters ?? []).map((s) => {
    const linked = s.leaders as unknown as { name: string } | null
    return {
      id: s.id,
      kind: "apoiador",
      name: s.name,
      neighborhood: s.neighborhood,
      city: s.city,
      phone: s.phone,
      leaderName: linked?.name ?? null,
    }
  })

  return [...leaderRows, ...supporterRows].sort((a, b) => {
    const cityCmp = (a.city ?? "").localeCompare(b.city ?? "")
    if (cityCmp !== 0) return cityCmp
    const neighborhoodCmp = (a.neighborhood ?? "").localeCompare(b.neighborhood ?? "")
    if (neighborhoodCmp !== 0) return neighborhoodCmp
    return a.name.localeCompare(b.name)
  })
}

/** Cidades distintas somando lideranças e apoiadores — pro filtro do relatório geral. */
export async function listDistinctRegistrationCities(supabase: DB) {
  const [leaderCities, supporterCities] = await Promise.all([
    listDistinctLeaderCities(supabase),
    listDistinctSupporterCities(supabase),
  ])
  return Array.from(new Set([...leaderCities, ...supporterCities])).sort((a, b) => a.localeCompare(b))
}

/** Bairros distintos somando lideranças e apoiadores, com o mesmo filtro em
 * cascata por cidade dos outros relatórios. */
export async function listDistinctRegistrationNeighborhoods(supabase: DB, filters?: { city?: string }) {
  const [leaderNeighborhoods, supporterNeighborhoods] = await Promise.all([
    listDistinctLeaderNeighborhoods(supabase, filters),
    listDistinctSupporterNeighborhoods(supabase, filters),
  ])
  return Array.from(new Set([...leaderNeighborhoods, ...supporterNeighborhoods])).sort((a, b) => a.localeCompare(b))
}

// ----------------------------------------------------------------------------
// Expectativa de votos — relatório restrito a admin_geral (não faz parte do
// grupo de relatórios que admin_equipe também acessa): cruza
// expected_votes (o que a própria liderança diz que entrega) com
// admin_estimated_votes, que é um campo admin-only em todo o resto do
// sistema (ver comentário em liderancas/actions.ts) — faria pouco sentido
// esse relatório ficar visível pra quem não pode nem ver o campo no
// cadastro individual.
// ----------------------------------------------------------------------------
export type VotesSummary = {
  totalLeaders: number
  leadersWithExpectedVotes: number
  leadersWithAdminEstimate: number
  totalExpectedVotes: number
  totalAdminEstimatedVotes: number
}

export type VotesByGroupRow = {
  /** Nome da cidade (getVotesByCity) ou do bairro (getVotesByNeighborhood). */
  label: string
  /** Só preenchido em getVotesByNeighborhood, pra mostrar a cidade ao lado. */
  city?: string | null
  leaderCount: number
  expectedVotes: number
  adminEstimatedVotes: number
}

async function listVoteRows(supabase: DB, filters?: { city?: string; neighborhood?: string }) {
  let query = supabase.from("leaders").select("city, neighborhood, expected_votes, admin_estimated_votes")
  if (filters?.city) query = query.eq("city", filters.city)
  if (filters?.neighborhood) query = query.eq("neighborhood", filters.neighborhood)
  const { data, error } = await query
  if (error) throw new Error(`Falha ao gerar relatório de votos: ${error.message}`)
  return data
}

export async function getVotesSummary(supabase: DB): Promise<VotesSummary> {
  const rows = await listVoteRows(supabase)
  let totalExpectedVotes = 0
  let totalAdminEstimatedVotes = 0
  let leadersWithExpectedVotes = 0
  let leadersWithAdminEstimate = 0

  for (const row of rows) {
    if (row.expected_votes != null) {
      totalExpectedVotes += row.expected_votes
      leadersWithExpectedVotes += 1
    }
    if (row.admin_estimated_votes != null) {
      totalAdminEstimatedVotes += row.admin_estimated_votes
      leadersWithAdminEstimate += 1
    }
  }

  return {
    totalLeaders: rows.length,
    leadersWithExpectedVotes,
    leadersWithAdminEstimate,
    totalExpectedVotes,
    totalAdminEstimatedVotes,
  }
}

/** Soma expected_votes/admin_estimated_votes agrupado por cidade — ordenado
 * pelo total informado pela liderança (o campo que mais frequentemente vem
 * preenchido; a avaliação do admin pode ainda não existir pra várias). Filtro
 * opcional por cidade — reduz a tabela a uma única linha, útil pra isolar o
 * relatório (e o PDF) de uma cidade específica, mesmo filtro que já existia
 * só na tabela "por bairro". */
export async function getVotesByCity(supabase: DB, filters?: { city?: string }): Promise<VotesByGroupRow[]> {
  const rows = await listVoteRows(supabase, filters)
  const groups = new Map<string, VotesByGroupRow>()

  for (const row of rows) {
    const key = row.city ?? "Sem cidade"
    const current = groups.get(key) ?? { label: key, leaderCount: 0, expectedVotes: 0, adminEstimatedVotes: 0 }
    current.leaderCount += 1
    current.expectedVotes += row.expected_votes ?? 0
    current.adminEstimatedVotes += row.admin_estimated_votes ?? 0
    groups.set(key, current)
  }

  return Array.from(groups.values()).sort((a, b) => b.expectedVotes - a.expectedVotes)
}

/** Mesma agregação, por bairro — com o mesmo filtro em cascata cidade→bairro
 * dos outros relatórios (ver relatorios/liderancas/page.tsx). Chave de
 * agrupamento combina cidade+bairro pra não misturar bairros de mesmo nome
 * em cidades diferentes. */
export async function getVotesByNeighborhood(
  supabase: DB,
  filters?: { city?: string; neighborhood?: string },
): Promise<VotesByGroupRow[]> {
  const rows = await listVoteRows(supabase, filters)
  const groups = new Map<string, VotesByGroupRow>()

  for (const row of rows) {
    const key = `${row.city ?? "Sem cidade"}::${row.neighborhood ?? "Sem bairro"}`
    const current = groups.get(key) ?? {
      label: row.neighborhood ?? "Sem bairro",
      city: row.city,
      leaderCount: 0,
      expectedVotes: 0,
      adminEstimatedVotes: 0,
    }
    current.leaderCount += 1
    current.expectedVotes += row.expected_votes ?? 0
    current.adminEstimatedVotes += row.admin_estimated_votes ?? 0
    groups.set(key, current)
  }

  return Array.from(groups.values()).sort((a, b) => b.expectedVotes - a.expectedVotes)
}

// ----------------------------------------------------------------------------
// Expectativa x eleitorado por local de votação — cruza expected_votes/
// admin_estimated_votes (agrupados pelo polling_location_id que a própria
// liderança tem cadastrado) com eleitores_total de polling_locations
// (dado do TSE já importado, ver schema.sql). Chamamos esse segundo número
// de "eleitorado" e não de "resultado real da eleição" de propósito: o
// sistema ainda não importa boletim de urna/resultado oficial (isso só
// existe depois do dia da votação) — o que dá pra comparar HOJE é a
// expectativa informada contra o total de eleitores registrados naquele
// local, como referência de teto/cobertura, não como resultado de votos.
// ----------------------------------------------------------------------------
export type VotesByPollingLocationRow = {
  id: string
  /** Nome do local de votação (polling_locations.nome). */
  label: string
  /** Município do local (polling_locations.municipio_nome). */
  city: string | null
  leaderCount: number
  expectedVotes: number
  adminEstimatedVotes: number
  /** Eleitorado total registrado nesse local, segundo o TSE (referência —
   * não é resultado de votação, ver nota acima). Null se o local não tiver
   * esse dado (não deveria acontecer com os dados de PE já importados). */
  registeredVoters: number | null
  /** expectedVotes / registeredVoters em % (1 casa decimal) — null se não
   * houver eleitorado cadastrado pra esse local. */
  coveragePct: number | null
}

type LeaderPollingLocationRow = {
  polling_location_id: string | null
  expected_votes: number | null
  admin_estimated_votes: number | null
  polling_locations: { nome: string; municipio_nome: string; eleitores_total: number | null } | null
}

/**
 * Agrupa por local de votação. Retorna também quantas lideranças ainda não
 * têm local de votação informado (leadersWithoutLocation) — útil pra medir
 * quão completo/confiável o relatório está, já que ele só reflete quem
 * preencheu o campo no cadastro.
 */
export async function getVotesByPollingLocation(
  supabase: DB,
  filters?: { city?: string; neighborhood?: string },
): Promise<{ rows: VotesByPollingLocationRow[]; leadersWithoutLocation: number }> {
  let query = supabase
    .from("leaders")
    .select("polling_location_id, expected_votes, admin_estimated_votes, polling_locations(nome, municipio_nome, eleitores_total)")
  if (filters?.city) query = query.eq("city", filters.city)
  if (filters?.neighborhood) query = query.eq("neighborhood", filters.neighborhood)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao gerar relatório por local de votação: ${error.message}`)

  // Ver nota equivalente em services/supporters.ts sobre o cast de relações
  // embutidas por causa do schema "any" do client.
  const rows = data as unknown as LeaderPollingLocationRow[]

  const groups = new Map<string, VotesByPollingLocationRow>()
  let leadersWithoutLocation = 0

  for (const row of rows) {
    if (!row.polling_location_id || !row.polling_locations) {
      leadersWithoutLocation += 1
      continue
    }
    const current = groups.get(row.polling_location_id) ?? {
      id: row.polling_location_id,
      label: row.polling_locations.nome,
      city: row.polling_locations.municipio_nome,
      leaderCount: 0,
      expectedVotes: 0,
      adminEstimatedVotes: 0,
      registeredVoters: row.polling_locations.eleitores_total,
      coveragePct: null,
    }
    current.leaderCount += 1
    current.expectedVotes += row.expected_votes ?? 0
    current.adminEstimatedVotes += row.admin_estimated_votes ?? 0
    groups.set(row.polling_location_id, current)
  }

  const result = Array.from(groups.values())
    .map((row) => ({
      ...row,
      coveragePct: row.registeredVoters ? Math.round((row.expectedVotes / row.registeredVoters) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.expectedVotes - a.expectedVotes)

  return { rows: result, leadersWithoutLocation }
}

// ----------------------------------------------------------------------------
// Cadastros (lideranças + apoiadores) por local de votação — relatório
// separado do de expectativa de votos acima: aqui não entra expected_votes/
// admin_estimated_votes (que só existe em leaders), é só a contagem de
// quantos cadastros de cada tipo estão vinculados a cada local, pedido
// explícito da Agência F4 pra saber onde a base de eleitores/rede está
// concentrada, independente de expectativa.
// ----------------------------------------------------------------------------
export type RegistrationsByPollingLocationRow = {
  id: string
  /** Nome do local de votação (polling_locations.nome). */
  label: string
  /** Município do local (polling_locations.municipio_nome). */
  city: string | null
  leaderCount: number
  supporterCount: number
  totalCount: number
}

type PersonPollingLocationRow = {
  polling_location_id: string | null
  polling_locations: { nome: string; municipio_nome: string } | null
}

/**
 * Agrupa lideranças e apoiadores pelo local de votação vinculado. O filtro
 * de cidade usa a cidade cadastrada da própria pessoa (leaders.city /
 * supporters.city — onde ela mora), mesma convenção dos outros relatórios,
 * não a cidade do local de votação (podem divergir, embora raro).
 * Retorna também quantos cadastros de cada tipo ainda não têm local de
 * votação informado — mede quão completo o relatório está.
 */
export async function getRegistrationsByPollingLocation(
  supabase: DB,
  filters?: { city?: string },
): Promise<{
  rows: RegistrationsByPollingLocationRow[]
  leadersWithoutLocation: number
  supportersWithoutLocation: number
}> {
  let leadersQuery = supabase.from("leaders").select("polling_location_id, polling_locations(nome, municipio_nome)")
  let supportersQuery = supabase.from("supporters").select("polling_location_id, polling_locations(nome, municipio_nome)")
  if (filters?.city) {
    leadersQuery = leadersQuery.eq("city", filters.city)
    supportersQuery = supportersQuery.eq("city", filters.city)
  }

  const [{ data: leaderRows, error: leadersError }, { data: supporterRows, error: supportersError }] = await Promise.all([
    leadersQuery,
    supportersQuery,
  ])
  if (leadersError) throw new Error(`Falha ao gerar relatório de cadastros por local de votação: ${leadersError.message}`)
  if (supportersError) throw new Error(`Falha ao gerar relatório de cadastros por local de votação: ${supportersError.message}`)

  // Ver nota equivalente em services/supporters.ts sobre o cast de relações
  // embutidas por causa do schema "any" do client.
  const leaders = leaderRows as unknown as PersonPollingLocationRow[]
  const supporters = supporterRows as unknown as PersonPollingLocationRow[]

  const groups = new Map<string, RegistrationsByPollingLocationRow>()
  let leadersWithoutLocation = 0
  let supportersWithoutLocation = 0

  function getOrCreate(row: PersonPollingLocationRow): RegistrationsByPollingLocationRow | null {
    if (!row.polling_location_id || !row.polling_locations) return null
    const current = groups.get(row.polling_location_id) ?? {
      id: row.polling_location_id,
      label: row.polling_locations.nome,
      city: row.polling_locations.municipio_nome,
      leaderCount: 0,
      supporterCount: 0,
      totalCount: 0,
    }
    groups.set(row.polling_location_id, current)
    return current
  }

  for (const row of leaders) {
    const group = getOrCreate(row)
    if (!group) {
      leadersWithoutLocation += 1
      continue
    }
    group.leaderCount += 1
    group.totalCount += 1
  }
  for (const row of supporters) {
    const group = getOrCreate(row)
    if (!group) {
      supportersWithoutLocation += 1
      continue
    }
    group.supporterCount += 1
    group.totalCount += 1
  }

  const rows = Array.from(groups.values()).sort((a, b) => b.totalCount - a.totalCount)
  return { rows, leadersWithoutLocation, supportersWithoutLocation }
}

// ----------------------------------------------------------------------------
// Helpers de agregação em memória
// ----------------------------------------------------------------------------
function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const value = row[key] as string | null
    if (!value) continue
    map.set(value, (map.get(value) ?? 0) + 1)
  }
  return map
}

function maxDateBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    const groupKey = row[key] as string | null
    const createdAt = row["created_at"] as string
    if (!groupKey) continue
    const current = map.get(groupKey)
    if (!current || createdAt > current) map.set(groupKey, createdAt)
  }
  return map
}
