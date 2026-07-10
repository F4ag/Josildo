// Camada de acesso a dados de Modelos de Mensagem (Módulo 12).
// A RLS (mt_select_active, ver supabase/rls_policies.sql) já limita quem
// não é admin_geral a enxergar só os modelos com status="ativo" — este
// service não precisa reforçar isso, só reflete o que o Postgres devolve.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { MessageTemplate, MessageTemplateType } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

export type MessageTemplateFilters = {
  type?: MessageTemplateType
  status?: "ativo" | "inativo"
}

export async function listMessageTemplates(supabase: DB, filters: MessageTemplateFilters = {}) {
  let query = supabase.from("message_templates").select("*").order("name", { ascending: true })

  if (filters.type) query = query.eq("type", filters.type)
  if (filters.status) query = query.eq("status", filters.status)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar modelos de mensagem: ${error.message}`)
  return data as MessageTemplate[]
}

export async function getMessageTemplateById(supabase: DB, id: string) {
  const { data, error } = await supabase.from("message_templates").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`Falha ao buscar modelo de mensagem: ${error.message}`)
  return data as MessageTemplate | null
}

export type MessageTemplateInput = Omit<
  Database["public"]["Tables"]["message_templates"]["Insert"],
  "id" | "created_at" | "updated_at" | "created_by" | "status"
>

export async function createMessageTemplate(supabase: DB, input: MessageTemplateInput, createdBy: string) {
  const { data, error } = await supabase
    .from("message_templates")
    .insert({ ...input, created_by: createdBy, status: "ativo" })
    .select()
    .single()
  if (error) throw new Error(`Falha ao criar modelo de mensagem: ${error.message}`)
  return data
}

export async function updateMessageTemplate(supabase: DB, id: string, input: Partial<MessageTemplateInput>) {
  const { data, error } = await supabase
    .from("message_templates")
    .update(input)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(`Falha ao atualizar modelo de mensagem: ${error.message}`)
  return data
}

export async function toggleMessageTemplateStatus(supabase: DB, id: string, currentStatus: "ativo" | "inativo") {
  const nextStatus = currentStatus === "ativo" ? "inativo" : "ativo"
  const { error } = await supabase.from("message_templates").update({ status: nextStatus }).eq("id", id)
  if (error) throw new Error(`Falha ao atualizar status do modelo: ${error.message}`)
}
