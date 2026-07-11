// Camada de acesso a dados de Atendimentos (Módulo 7).
// Regra obrigatória: supporter_id é NOT NULL no schema — todo atendimento
// tem uma pessoa atendida (ver supabase/schema.sql).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { Attendance, AttendanceType, AttendanceStatus, Priority } from "@/types/domain"
import { logInteraction } from "./interactions"

// O terceiro genérico é "any" de propósito: @supabase/ssr e @supabase/supabase-js
// às vezes resolvem o tipo padrão do schema de formas incompatíveis entre si
// (erro de build "não pode ser atribuído ao tipo 'public'"), então fixamos o
// schema aqui em vez de depender do valor padrão de cada versão.
type DB = SupabaseClient<Database, "public", any>

export type AttendanceFilters = {
  supporterId?: string
  leaderId?: string
  status?: AttendanceStatus
  attendanceType?: AttendanceType
  priority?: Priority
  responsibleUserId?: string
}

// Linha de atendimento com os relacionamentos embutidos usados nas telas
// (atendimentos/page.tsx e atendimentos/[id]/page.tsx). Tipado à mão porque,
// com o schema "any" do client (ver nota em lib/supabase/server.ts), o
// TypeScript perde a cardinalidade dessas relações embutidas e as infere
// como array em vez de objeto único — o formato abaixo é o que o PostgREST
// realmente devolve em runtime (supporter_id/leader_id são N:1).
export type AttendanceWithRelations = Attendance & {
  supporters: { id: string; name: string; neighborhood?: string | null; phone?: string; consent_whatsapp?: boolean } | null
  leaders: { id: string; name: string } | null
}

export async function listAttendances(supabase: DB, filters: AttendanceFilters = {}) {
  let query = supabase
    .from("attendances")
    .select("*, supporters(name, neighborhood), leaders(name)")
    .order("created_at", { ascending: false })

  if (filters.supporterId) query = query.eq("supporter_id", filters.supporterId)
  if (filters.leaderId) query = query.eq("leader_id", filters.leaderId)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.attendanceType) query = query.eq("attendance_type", filters.attendanceType)
  if (filters.priority) query = query.eq("priority", filters.priority)
  if (filters.responsibleUserId) query = query.eq("responsible_user_id", filters.responsibleUserId)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar atendimentos: ${error.message}`)
  return data as unknown as AttendanceWithRelations[]
}

export async function getAttendanceById(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("attendances")
    .select("*, supporters(id, name, phone, consent_whatsapp), leaders(id, name)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Falha ao buscar atendimento: ${error.message}`)
  return data as unknown as AttendanceWithRelations | null
}

export type AttendanceInput = Omit<
  Database["public"]["Tables"]["attendances"]["Insert"],
  "id" | "created_at" | "updated_at" | "created_by" | "status" | "attended_at" | "organization_id"
>

export async function createAttendance(supabase: DB, input: AttendanceInput, createdBy: string, organizationId: string) {
  const { data, error } = await supabase
    .from("attendances")
    .insert({ ...input, created_by: createdBy, status: "novo", organization_id: organizationId })
    .select()
    .single()
  if (error) throw new Error(`Falha ao registrar atendimento: ${error.message}`)

  await logInteraction(supabase, {
    leaderId: input.leader_id, supporterId: input.supporter_id,
    type: "atendimento", description: `Atendimento registrado: ${input.title}`, createdBy, organizationId,
  })

  return data
}

/** Única forma de mudar status — grava a interação e marca attended_at quando concluído. */
export async function updateAttendanceStatus(
  supabase: DB,
  attendance: Pick<Attendance, "id" | "leader_id" | "supporter_id" | "title">,
  input: {
    status: AttendanceStatus
    resultDescription?: string
    returnSent?: boolean
    returnChannel?: string
  },
  updatedBy: string,
  organizationId: string,
) {
  const isConcluded = input.status === "atendido" || input.status === "nao_atendido"

  const { error } = await supabase
    .from("attendances")
    .update({
      status: input.status,
      result_description: input.resultDescription || undefined,
      return_sent: input.returnSent ?? undefined,
      return_channel: (input.returnChannel || undefined) as Database["public"]["Tables"]["attendances"]["Row"]["return_channel"],
      attended_at: isConcluded ? new Date().toISOString() : undefined,
    })
    .eq("id", attendance.id)
  if (error) throw new Error(`Falha ao atualizar status do atendimento: ${error.message}`)

  await logInteraction(supabase, {
    leaderId: attendance.leader_id, supporterId: attendance.supporter_id,
    type: "atendimento",
    description: `Atendimento "${attendance.title}" atualizado para: ${input.status}.`,
    createdBy: updatedBy,
    organizationId,
  })
}

export type AttendanceStatusCounts = {
  total: number
  emAberto: number
  atendidos: number
  naoAtendidos: number
}

// Mesma lista de status "em aberto" usada em services/dashboard.ts
// (OPEN_ATTENDANCE_STATUSES) — mantida separada aqui porque cada service
// só expõe o que a própria tela precisa.
const OPEN_ATTENDANCE_STATUSES = [
  "novo", "em_analise", "em_andamento", "aguardando_documento", "aguardando_orgao_publico",
] as const

/** Contagens pros cards de resumo no topo de /atendimentos — não é afetada
 * pelos filtros da tela, mesmo padrão de getDemandStatusCounts. */
export async function getAttendanceStatusCounts(supabase: DB): Promise<AttendanceStatusCounts> {
  const [{ count: total }, { count: emAberto }, { count: atendidos }, { count: naoAtendidos }] =
    await Promise.all([
      supabase.from("attendances").select("id", { count: "exact", head: true }),
      supabase
        .from("attendances")
        .select("id", { count: "exact", head: true })
        .in("status", OPEN_ATTENDANCE_STATUSES),
      supabase.from("attendances").select("id", { count: "exact", head: true }).eq("status", "atendido"),
      supabase.from("attendances").select("id", { count: "exact", head: true }).eq("status", "nao_atendido"),
    ])

  return {
    total: total ?? 0,
    emAberto: emAberto ?? 0,
    atendidos: atendidos ?? 0,
    naoAtendidos: naoAtendidos ?? 0,
  }
}
