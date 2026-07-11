// Histórico de interações (Módulo 14). Chamado a partir dos services de
// demandas/atendimentos para gravar automaticamente — nunca exigir que
// quem chama a action lembre de registrar isso à mão.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { InteractionType } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

export async function logInteraction(
  supabase: DB,
  input: {
    leaderId?: string | null
    supporterId?: string | null
    type: InteractionType
    description: string
    createdBy: string
    organizationId: string
  },
) {
  if (!input.leaderId && !input.supporterId) return // nada a vincular, não registra

  const { error } = await supabase.from("interactions").insert({
    leader_id: input.leaderId ?? null,
    supporter_id: input.supporterId ?? null,
    person_type: input.supporterId ? "apoiador" : "lideranca",
    interaction_type: input.type,
    description: input.description,
    created_by: input.createdBy,
    organization_id: input.organizationId,
  })

  // Falha ao registrar histórico não deve derrubar a ação principal (criar
  // demanda, concluir atendimento) — só loga no servidor.
  if (error) console.error("Falha ao registrar interação:", error.message)
}

export async function listInteractionsForSupporter(supabase: DB, supporterId: string) {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("supporter_id", supporterId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Falha ao listar interações: ${error.message}`)
  return data
}

export async function listInteractionsForLeader(supabase: DB, leaderId: string) {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("leader_id", leaderId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Falha ao listar interações: ${error.message}`)
  return data
}
