// Mapa territorial (Módulo 8). Só entram no mapa registros com
// latitude/longitude preenchidos — leaders.latitude/longitude e
// demands.latitude/longitude já existem no schema como numeric(9,6)
// (ver nota em supabase/schema.sql linha 10: geocodificação automática por
// endereço fica para depois do MVP; por enquanto é um campo numérico
// simples, preenchido manualmente ou por uma integração futura).
//
// Não existe filtro extra de role aqui: a RLS já garante que uma liderança
// só recebe a própria linha em `leaders` (ld_lideranca_select_self) e só as
// demandas ligadas a ela em `demands` — mesmo padrão usado no resto do app
// (ex.: services/demands.ts). O client Supabase usado nestas funções é
// sempre o autenticado (nunca o admin/service_role).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { LeaderStatus, DemandStatus } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

export type MapFilters = { neighborhood?: string }

export type MapLeaderPin = {
  id: string
  name: string
  status: LeaderStatus
  neighborhood: string | null
  latitude: number
  longitude: number
}

export type MapDemandPin = {
  id: string
  title: string
  status: DemandStatus
  neighborhood: string | null
  latitude: number
  longitude: number
}

export async function listMapLeaders(supabase: DB, filters: MapFilters = {}): Promise<MapLeaderPin[]> {
  let query = supabase
    .from("leaders")
    .select("id, name, status, neighborhood, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
  if (filters.neighborhood) query = query.eq("neighborhood", filters.neighborhood)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar lideranças no mapa: ${error.message}`)

  return (data ?? [])
    .filter((l): l is typeof l & { latitude: number; longitude: number } => l.latitude !== null && l.longitude !== null)
    .map((l) => ({
      id: l.id,
      name: l.name,
      status: l.status as LeaderStatus,
      neighborhood: l.neighborhood,
      latitude: Number(l.latitude),
      longitude: Number(l.longitude),
    }))
}

export async function listMapDemands(supabase: DB, filters: MapFilters = {}): Promise<MapDemandPin[]> {
  let query = supabase
    .from("demands")
    .select("id, title, status, neighborhood, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
  if (filters.neighborhood) query = query.eq("neighborhood", filters.neighborhood)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar demandas no mapa: ${error.message}`)

  return (data ?? [])
    .filter((d): d is typeof d & { latitude: number; longitude: number } => d.latitude !== null && d.longitude !== null)
    .map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status as DemandStatus,
      neighborhood: d.neighborhood,
      latitude: Number(d.latitude),
      longitude: Number(d.longitude),
    }))
}
