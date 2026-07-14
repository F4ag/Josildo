// Módulo 5 — "Pessoa Atendida" NÃO é uma tabela própria: é um supporter com
// pelo menos uma demand ou attendance. Este serviço só compõe leituras a
// partir de supporters/demands/attendances/interactions — nenhuma escrita
// nova, nenhum dado duplicado.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { Supporter } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

// Ver nota equivalente em services/attendances.ts sobre o cast de relações
// embutidas (leaders) por causa do schema "any" do client.
export type SupporterWithLeader = Supporter & {
  leaders: { id: string; name: string; phone?: string | null } | null
}

export async function listPessoasAtendidas(supabase: DB, filters?: { city?: string }) {
  const [{ data: demandRows, error: demandError }, { data: attendanceRows, error: attendanceError }] =
    await Promise.all([
      supabase.from("demands").select("supporter_id").not("supporter_id", "is", null),
      supabase.from("attendances").select("supporter_id"),
    ])

  if (demandError) throw new Error(`Falha ao listar pessoas atendidas: ${demandError.message}`)
  if (attendanceError) throw new Error(`Falha ao listar pessoas atendidas: ${attendanceError.message}`)

  const supporterIds = Array.from(
    new Set([...demandRows.map((r) => r.supporter_id), ...attendanceRows.map((r) => r.supporter_id)]),
  ).filter((id): id is string => Boolean(id))

  if (supporterIds.length === 0) return []

  let query = supabase
    .from("supporters")
    .select("*, leaders(name)")
    .in("id", supporterIds)
    .order("name", { ascending: true })
  if (filters?.city) query = query.eq("city", filters.city)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar pessoas atendidas: ${error.message}`)
  return data as unknown as SupporterWithLeader[]
}

export async function getPessoaAtendidaDetail(supabase: DB, supporterId: string) {
  const [{ data: supporter, error: supporterError }, { data: demands }, { data: attendances }, { data: interactions }] =
    await Promise.all([
      supabase.from("supporters").select("*, leaders(id, name, phone)").eq("id", supporterId).maybeSingle(),
      supabase.from("demands").select("*").eq("supporter_id", supporterId).order("created_at", { ascending: false }),
      supabase.from("attendances").select("*").eq("supporter_id", supporterId).order("created_at", { ascending: false }),
      supabase.from("interactions").select("*").eq("supporter_id", supporterId).order("created_at", { ascending: false }),
    ])

  if (supporterError) throw new Error(`Falha ao buscar pessoa atendida: ${supporterError.message}`)
  if (!supporter) return null

  return {
    supporter: supporter as unknown as SupporterWithLeader,
    demands: demands ?? [],
    attendances: attendances ?? [],
    interactions: interactions ?? [],
  }
}

export type PessoasAtendidasStats = {
  total: number
  comDemanda: number
  comAtendimento: number
}

/** Contagens pros cards de resumo no topo de /pessoas-atendidas — reaproveita
 * a mesma consulta de listPessoasAtendidas (supporter_id de demands e de
 * attendances) em vez de duplicar lógica de "quem é pessoa atendida". */
export async function getPessoasAtendidasStats(supabase: DB): Promise<PessoasAtendidasStats> {
  const [{ data: demandRows, error: demandError }, { data: attendanceRows, error: attendanceError }] =
    await Promise.all([
      supabase.from("demands").select("supporter_id").not("supporter_id", "is", null),
      supabase.from("attendances").select("supporter_id"),
    ])

  if (demandError) throw new Error(`Falha ao contar pessoas atendidas: ${demandError.message}`)
  if (attendanceError) throw new Error(`Falha ao contar pessoas atendidas: ${attendanceError.message}`)

  const comDemandaIds = new Set(demandRows.map((r) => r.supporter_id).filter(Boolean))
  const comAtendimentoIds = new Set(attendanceRows.map((r) => r.supporter_id).filter(Boolean))
  const totalIds = new Set([...comDemandaIds, ...comAtendimentoIds])

  return {
    total: totalIds.size,
    comDemanda: comDemandaIds.size,
    comAtendimento: comAtendimentoIds.size,
  }
}
