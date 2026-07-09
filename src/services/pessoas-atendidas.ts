// Módulo 5 — "Pessoa Atendida" NÃO é uma tabela própria: é um supporter com
// pelo menos uma demand ou attendance. Este serviço só compõe leituras a
// partir de supporters/demands/attendances/interactions — nenhuma escrita
// nova, nenhum dado duplicado.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type DB = SupabaseClient<Database, "public", any>

export async function listPessoasAtendidas(supabase: DB) {
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

  const { data, error } = await supabase
    .from("supporters")
    .select("*, leaders(name)")
    .in("id", supporterIds)
    .order("name", { ascending: true })
  if (error) throw new Error(`Falha ao listar pessoas atendidas: ${error.message}`)
  return data
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
    supporter,
    demands: demands ?? [],
    attendances: attendances ?? [],
    interactions: interactions ?? [],
  }
}
