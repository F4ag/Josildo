// Camada de acesso a dados de Demandas (Módulo 6).
// Regra estratégica do prompt master: toda demanda resolvida fica vinculada
// à liderança e/ou pessoa atendida, e toda mudança de status gera um
// registro em demand_updates — é isso que updateDemandStatus garante.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { Demand, DemandType, DemandStatus, Priority } from "@/types/domain"
import { logInteraction } from "./interactions"

type DB = SupabaseClient<Database, "public", any>

export type DemandFilters = {
  neighborhood?: string
  leaderId?: string
  supporterId?: string
  status?: DemandStatus
  demandType?: DemandType
  priority?: Priority
  responsibleUserId?: string
  search?: string
}

// Ver nota equivalente em services/attendances.ts sobre o cast de relações
// embutidas (leaders/supporters) por causa do schema "any" do client.
export type DemandWithRelations = Demand & {
  leaders: { id: string; name: string; phone?: string | null } | null
  supporters: { id: string; name: string; phone?: string | null } | null
}

export async function listDemands(supabase: DB, filters: DemandFilters = {}) {
  let query = supabase
    .from("demands")
    .select("*, leaders(name), supporters(name)")
    .order("created_at", { ascending: false })

  if (filters.neighborhood) query = query.eq("neighborhood", filters.neighborhood)
  if (filters.leaderId) query = query.eq("leader_id", filters.leaderId)
  if (filters.supporterId) query = query.eq("supporter_id", filters.supporterId)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.demandType) query = query.eq("demand_type", filters.demandType)
  if (filters.priority) query = query.eq("priority", filters.priority)
  if (filters.responsibleUserId) query = query.eq("responsible_user_id", filters.responsibleUserId)
  if (filters.search) query = query.ilike("title", `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar demandas: ${error.message}`)
  return data as unknown as DemandWithRelations[]
}

export async function getDemandById(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("demands")
    .select("*, leaders(id, name, phone), supporters(id, name, phone)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Falha ao buscar demanda: ${error.message}`)
  return data as unknown as DemandWithRelations | null
}

export async function getDemandHistory(supabase: DB, demandId: string) {
  const { data, error } = await supabase
    .from("demand_updates")
    .select("*")
    .eq("demand_id", demandId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Falha ao buscar histórico da demanda: ${error.message}`)
  return data
}

export type DemandInput = Omit<
  Database["public"]["Tables"]["demands"]["Insert"],
  "id" | "created_at" | "updated_at" | "created_by" | "status" | "completed_at"
>

export async function createDemand(supabase: DB, input: DemandInput, createdBy: string) {
  const { data, error } = await supabase
    .from("demands")
    .insert({ ...input, created_by: createdBy, status: "nova" })
    .select()
    .single()
  if (error) throw new Error(`Falha ao registrar demanda: ${error.message}`)

  await supabase.from("demand_updates").insert({
    demand_id: data.id, status: "nova", comment: "Demanda registrada.", updated_by: createdBy,
  })
  await logInteraction(supabase, {
    leaderId: input.leader_id, supporterId: input.supporter_id,
    type: "demanda", description: `Demanda registrada: ${input.title}`, createdBy,
  })

  return data
}

/**
 * Única forma de mudar o status de uma demanda — sempre grava o histórico
 * em demand_updates e a interação correspondente. Nunca fazer
 * `.update({ status })` direto numa página; passar por aqui.
 */
export async function updateDemandStatus(
  supabase: DB,
  demand: Pick<Demand, "id" | "leader_id" | "supporter_id" | "title">,
  input: { status: DemandStatus; comment?: string; resultDescription?: string },
  updatedBy: string,
) {
  const { error } = await supabase
    .from("demands")
    .update({
      status: input.status,
      result_description: input.resultDescription || undefined,
      completed_at: input.status === "resolvida" ? new Date().toISOString() : null,
    })
    .eq("id", demand.id)
  if (error) throw new Error(`Falha ao atualizar status da demanda: ${error.message}`)

  await supabase.from("demand_updates").insert({
    demand_id: demand.id, status: input.status, comment: input.comment || null, updated_by: updatedBy,
  })

  await logInteraction(supabase, {
    leaderId: demand.leader_id, supporterId: demand.supporter_id,
    type: "demanda",
    description: `Demanda "${demand.title}" atualizada para: ${input.status}.`,
    createdBy: updatedBy,
  })
}

export async function listDistinctDemandNeighborhoods(supabase: DB) {
  const { data, error } = await supabase.from("demands").select("neighborhood").not("neighborhood", "is", null)
  if (error) throw new Error(`Falha ao listar bairros: ${error.message}`)
  return Array.from(new Set(data.map((row) => row.neighborhood).filter(Boolean))) as string[]
}
