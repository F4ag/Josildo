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
  filters?: { city?: string; sortBy?: "neighborhood" | "city" },
): Promise<LeaderReportRow[]> {
  let leadersQuery = supabase.from("leaders").select("id, name, phone, neighborhood, city, status").order(filters?.sortBy ?? "neighborhood", { ascending: true })
  if (filters?.city) leadersQuery = leadersQuery.eq("city", filters.city)

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
