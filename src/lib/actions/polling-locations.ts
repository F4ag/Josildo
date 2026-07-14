"use server"

import { createClient } from "@/lib/supabase/server"
import { searchPollingLocations, type PollingLocationSuggestion } from "@/services/polling-locations"

export type { PollingLocationSuggestion }

/**
 * Busca server-side por local de votação — alimenta o autocomplete
 * (components/polling-location-autocomplete.tsx) nos cadastros de
 * liderança/apoiador. Usa o client do usuário logado (respeita a mesma RLS
 * de leitura — só authenticated — de qualquer outra tela), não o
 * service_role: não há nada sensível em polling_locations (dado público do
 * TSE), então não faz sentido contornar a RLS aqui.
 * Roda a cada digitação (com debounce no client), por isso o limite curto
 * de resultados já embutido em searchPollingLocations.
 */
export async function searchPollingLocationsAction(query: string): Promise<PollingLocationSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const supabase = await createClient()
  return searchPollingLocations(supabase, trimmed)
}
