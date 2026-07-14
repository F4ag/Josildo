// Dados agregados do Dashboard (Módulo 2). Segue a ordem definida em
// docs/01-arquitetura-tecnica.md §5: cards executivos, depois alertas,
// depois gráficos exploratórios.
//
// Nota sobre "demanda atrasada": o schema tem um status "atrasada", mas
// nada muda esse campo sozinho ainda — isso é a Edge Function agendada da
// Etapa 6 (Módulo 10). Até lá, calculamos atraso aqui mesmo comparando
// due_date com a data de hoje, o que é mais confiável do que confiar num
// campo que ninguém atualiza automaticamente.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type DB = SupabaseClient<Database, "public", any>

const OPEN_ATTENDANCE_STATUSES = [
  "novo", "em_analise", "em_andamento", "aguardando_documento", "aguardando_orgao_publico",
] as const

const CLOSED_DEMAND_STATUSES = ["resolvida", "cancelada", "recusada"] as const

export type DashboardSummary = {
  activeLeaders: number
  totalSupporters: number
  totalPessoasAtendidas: number
  demandsResolvedThisMonth: number
  attendancesPending: number
}

export async function getDashboardSummary(supabase: DB): Promise<DashboardSummary> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { count: activeLeaders },
    { count: totalSupporters },
    { count: demandsResolvedThisMonth },
    { count: attendancesPending },
    { data: pessoaSupporterIdsFromDemands },
    { data: pessoaSupporterIdsFromAttendances },
  ] = await Promise.all([
    supabase.from("leaders").select("id", { count: "exact", head: true }).eq("status", "ativa"),
    supabase.from("supporters").select("id", { count: "exact", head: true }),
    supabase
      .from("demands")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolvida")
      .gte("completed_at", startOfMonth.toISOString()),
    supabase.from("attendances").select("id", { count: "exact", head: true }).in("status", OPEN_ATTENDANCE_STATUSES),
    supabase.from("demands").select("supporter_id").not("supporter_id", "is", null),
    supabase.from("attendances").select("supporter_id"),
  ])

  const pessoasAtendidasIds = new Set([
    ...(pessoaSupporterIdsFromDemands ?? []).map((r) => r.supporter_id),
    ...(pessoaSupporterIdsFromAttendances ?? []).map((r) => r.supporter_id),
  ])

  return {
    activeLeaders: activeLeaders ?? 0,
    totalSupporters: totalSupporters ?? 0,
    totalPessoasAtendidas: pessoasAtendidasIds.size,
    demandsResolvedThisMonth: demandsResolvedThisMonth ?? 0,
    attendancesPending: attendancesPending ?? 0,
  }
}

export type OverdueDemand = { id: string; title: string; due_date: string | null; neighborhood: string | null }

export async function listOverdueDemands(supabase: DB, limit = 5): Promise<OverdueDemand[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("demands")
    .select("id, title, due_date, neighborhood")
    .lt("due_date", today)
    .not("status", "in", `(${CLOSED_DEMAND_STATUSES.join(",")})`)
    .order("due_date", { ascending: true })
    .limit(limit)
  if (error) throw new Error(`Falha ao listar demandas atrasadas: ${error.message}`)
  return data
}

export type BirthdayToday = {
  id: string
  name: string
  phone: string
  neighborhood: string | null
  /** Módulo 15 (LGPD): só true se o apoiador consentiu contato via WhatsApp
   * especificamente — WhatsAppButton usa isso pra desabilitar o botão. */
  consentWhatsapp: boolean
}

export async function listBirthdaysToday(supabase: DB): Promise<BirthdayToday[]> {
  // PostgREST não filtra por "mês/dia" de uma coluna date diretamente, então
  // trazemos os campos mínimos e filtramos aqui — mesmo padrão já usado em
  // services/supporters.ts (listSupporters com birthMonth).
  const { data, error } = await supabase.from("supporters").select("id, name, phone, birth_date, consent_whatsapp")
  if (error) throw new Error(`Falha ao listar aniversariantes: ${error.message}`)

  const today = new Date()
  return data
    .filter((s) => {
      const birth = new Date(`${s.birth_date}T00:00:00`)
      return birth.getMonth() === today.getMonth() && birth.getDate() === today.getDate()
    })
    .map((s) => ({ id: s.id, name: s.name, phone: s.phone, neighborhood: null, consentWhatsapp: s.consent_whatsapp }))
}

export type CategoryCount = { label: string; count: number }

/** Agrupamento genérico de contagem por coluna (cidade ou bairro), usado
 * pelos 4 gráficos exploratórios do Dashboard (lideranças/apoiadores ×
 * cidade/bairro). Mesma lógica de sempre (agrega em memória em vez de
 * depender de agregação no PostgREST), só generalizada pra não repetir a
 * mesma função 4 vezes com nomes de coluna diferentes. */
async function getCountsByColumn(
  supabase: DB,
  table: "leaders" | "supporters",
  column: "city" | "neighborhood",
  limit: number,
): Promise<CategoryCount[]> {
  const { data, error } = await supabase.from(table).select(column).not(column, "is", null)
  if (error) throw new Error(`Falha ao agrupar ${table} por ${column}: ${error.message}`)

  const counts = new Map<string, number>()
  for (const row of data as unknown as Record<string, string>[]) {
    // tsconfig tem noUncheckedIndexedAccess, então o TS trata acesso por
    // índice dinâmico (row[column]) como possivelmente undefined mesmo o
    // Record sendo <string, string> — na prática nunca é (o filtro
    // .not(column, "is", null) já garante isso), mas o guard abaixo
    // satisfaz o compilador e ainda protege contra linha malformada.
    const key = row[column]
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export async function getLeadersByCity(supabase: DB, limit = 10): Promise<CategoryCount[]> {
  return getCountsByColumn(supabase, "leaders", "city", limit)
}

export async function getLeadersByNeighborhood(supabase: DB, limit = 10): Promise<CategoryCount[]> {
  return getCountsByColumn(supabase, "leaders", "neighborhood", limit)
}

export async function getSupportersByCity(supabase: DB, limit = 10): Promise<CategoryCount[]> {
  return getCountsByColumn(supabase, "supporters", "city", limit)
}

export async function getSupportersByNeighborhood(supabase: DB, limit = 10): Promise<CategoryCount[]> {
  return getCountsByColumn(supabase, "supporters", "neighborhood", limit)
}
