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
  filters?: { city?: string },
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
