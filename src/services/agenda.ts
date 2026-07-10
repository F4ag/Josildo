// Camada de acesso a dados de Agenda (Módulo 13).
// Mesmo padrão de services/demands.ts: recebe o client Supabase por
// parâmetro, tipagem "any" no client por causa da divergência de schema
// entre @supabase/ssr e @supabase/supabase-js (ver nota em services/attendances.ts).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { AgendaEvent, AgendaStatus } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

export type AgendaEventFilters = {
  status?: AgendaStatus
  leaderId?: string
  neighborhood?: string
  /** Intervalo de datas (YYYY-MM-DD), inclusive dos dois lados. */
  dateFrom?: string
  dateTo?: string
}

// Ver nota equivalente em services/attendances.ts sobre o cast de relações
// embutidas (leaders/supporters) por causa do schema "any" do client.
export type AgendaEventWithRelations = AgendaEvent & {
  leaders: { id: string; name: string } | null
  supporters: { id: string; name: string } | null
}

export async function listAgendaEvents(supabase: DB, filters: AgendaEventFilters = {}) {
  let query = supabase
    .from("agenda_events")
    .select("*, leaders(id, name), supporters(id, name)")
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true })

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.leaderId) query = query.eq("leader_id", filters.leaderId)
  if (filters.neighborhood) query = query.eq("neighborhood", filters.neighborhood)
  if (filters.dateFrom) query = query.gte("event_date", filters.dateFrom)
  if (filters.dateTo) query = query.lte("event_date", filters.dateTo)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar compromissos: ${error.message}`)
  return data as unknown as AgendaEventWithRelations[]
}

export async function getAgendaEventById(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("agenda_events")
    .select("*, leaders(id, name), supporters(id, name)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Falha ao buscar compromisso: ${error.message}`)
  return data as unknown as AgendaEventWithRelations | null
}

export type AgendaEventInput = Omit<
  Database["public"]["Tables"]["agenda_events"]["Insert"],
  "id" | "created_at" | "updated_at" | "created_by" | "status"
>

export async function createAgendaEvent(supabase: DB, input: AgendaEventInput, createdBy: string) {
  const { data, error } = await supabase
    .from("agenda_events")
    .insert({ ...input, created_by: createdBy, status: "agendado" })
    .select()
    .single()
  if (error) throw new Error(`Falha ao registrar compromisso: ${error.message}`)
  return data
}

export async function updateAgendaEventStatus(supabase: DB, id: string, status: AgendaStatus) {
  const { data, error } = await supabase
    .from("agenda_events")
    .update({ status })
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(`Falha ao atualizar status do compromisso: ${error.message}`)
  return data
}

export type AgendaEventCounts = {
  total: number
  hoje: number
  semana: number
  pendentes: number
}

/** Contagens pros cards de resumo no topo de /agenda — não é afetada pelos
 * filtros da tela, mesmo padrão de getDemandStatusCounts em services/demands.ts. */
export async function getAgendaEventCounts(supabase: DB): Promise<AgendaEventCounts> {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  const [{ count: total }, { count: hoje }, { count: semana }, { count: pendentes }] = await Promise.all([
    supabase.from("agenda_events").select("id", { count: "exact", head: true }),
    supabase.from("agenda_events").select("id", { count: "exact", head: true }).eq("event_date", todayStr),
    supabase
      .from("agenda_events")
      .select("id", { count: "exact", head: true })
      .gte("event_date", todayStr)
      .lte("event_date", weekEndStr)
      .in("status", ["agendado", "pendente", "remarcado"]),
    supabase.from("agenda_events").select("id", { count: "exact", head: true }).eq("status", "pendente"),
  ])

  return {
    total: total ?? 0,
    hoje: hoje ?? 0,
    semana: semana ?? 0,
    pendentes: pendentes ?? 0,
  }
}
