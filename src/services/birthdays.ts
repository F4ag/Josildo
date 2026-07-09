// Aniversariantes (Módulo 9). PostgREST não filtra "mês/dia" de uma coluna
// date direto, então trazemos os campos mínimos de todo mundo e filtramos
// aqui — mesmo padrão já usado no dashboard e em listSupporters(birthMonth).
// Em base muito grande isso deveria virar uma view/function no Postgres;
// para uma campanha municipal (milhares de registros, não milhões) isso é
// rápido o suficiente.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type DB = SupabaseClient<Database, "public", any>

export type BirthdayRange = "hoje" | "amanha" | "semana" | "mes"

export type BirthdayRow = {
  id: string
  name: string
  phone: string
  neighborhood: string | null
  leaderId: string | null
  leaderName: string | null
  birthDate: string
  daysUntil: number
  alreadyGreetedToday: boolean
  /** Módulo 15 (LGPD): só true se o apoiador consentiu contato via WhatsApp
   * especificamente (diferente de consent_registration) — WhatsAppButton usa
   * isso pra desabilitar o botão quando a pessoa não autorizou esse canal. */
  consentWhatsapp: boolean
}

function dayOfYear(month: number, day: number, referenceYear: number): number {
  return Math.floor((Date.UTC(referenceYear, month, day) - Date.UTC(referenceYear, 0, 1)) / 86_400_000)
}

function daysUntilNextBirthday(birthDate: Date, today: Date): number {
  const todayDoY = dayOfYear(today.getMonth(), today.getDate(), today.getFullYear())
  let birthDoY = dayOfYear(birthDate.getMonth(), birthDate.getDate(), today.getFullYear())
  let diff = birthDoY - todayDoY
  if (diff < 0) {
    // já passou este ano — conta pro próximo (~365 dias corridos)
    birthDoY = dayOfYear(birthDate.getMonth(), birthDate.getDate(), today.getFullYear() + 1)
    diff = birthDoY - todayDoY + dayOfYear(11, 31, today.getFullYear()) + 1
  }
  return diff
}

const RANGE_MAX_DAYS: Record<BirthdayRange, number> = { hoje: 0, amanha: 1, semana: 7, mes: 30 }

export async function listBirthdays(
  supabase: DB,
  range: BirthdayRange,
  filters: { neighborhood?: string; leaderId?: string } = {},
): Promise<BirthdayRow[]> {
  let query = supabase
    .from("supporters")
    .select("id, name, phone, neighborhood, birth_date, leader_id, consent_whatsapp, leaders(id, name)")
  if (filters.neighborhood) query = query.eq("neighborhood", filters.neighborhood)
  if (filters.leaderId) query = query.eq("leader_id", filters.leaderId)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar aniversariantes: ${error.message}`)

  const today = new Date()
  const maxDays = RANGE_MAX_DAYS[range]

  const todayStr = today.toISOString().slice(0, 10)
  const { data: greetedToday } = await supabase
    .from("interactions")
    .select("supporter_id")
    .eq("interaction_type", "aniversario")
    .gte("created_at", `${todayStr}T00:00:00`)
  const greetedIds = new Set((greetedToday ?? []).map((r) => r.supporter_id))

  return data
    .map((s) => {
      const birth = new Date(`${s.birth_date}T00:00:00`)
      const daysUntil = range === "amanha" ? -1 : daysUntilNextBirthday(birth, today)
      return { s, birth, daysUntil }
    })
    .filter(({ daysUntil, birth }) => {
      if (range === "amanha") {
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        return birth.getMonth() === tomorrow.getMonth() && birth.getDate() === tomorrow.getDate()
      }
      return daysUntil >= 0 && daysUntil <= maxDays
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map(({ s, daysUntil }) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      neighborhood: s.neighborhood,
      leaderId: s.leader_id,
      // Cast pontual: com o schema "any" (ver nota em lib/supabase/server.ts),
      // o TypeScript perde a cardinalidade da relação embutida leaders(...)
      // e passa a inferir como array em vez de objeto único — mas em
      // runtime o PostgREST devolve um objeto (leader_id é N:1), então o
      // cast reflete o formato real.
      leaderName: (s.leaders as { name: string } | null)?.name ?? null,
      birthDate: s.birth_date,
      daysUntil: range === "amanha" ? 1 : daysUntil,
      alreadyGreetedToday: greetedIds.has(s.id),
      consentWhatsapp: s.consent_whatsapp,
    }))
}
