import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { listMapLeaders, listMapSupporters } from "@/services/map"
import { listDistinctLeaderNeighborhoods } from "@/services/leaders"
import { listDistinctSupporterNeighborhoods } from "@/services/supporters"
import { TerritoryMapLoader } from "@/components/map/territory-map-loader"
import { LEADER_STATUS_LABELS, LEADER_STATUS_COLOR } from "@/types/domain"
import { STATUS_COLOR_HEX, SUPPORTER_PIN_COLOR } from "@/lib/map-colors"

export const metadata: Metadata = { title: "Mapa Territorial · Lidera+" }

// Editar uma liderança/apoiador/demanda chama geocodeAddress() e grava
// latitude/longitude no banco (ver actions.ts de cada módulo) — mas o
// Next.js cacheia por padrão as chamadas fetch feitas no servidor
// (Data Cache), inclusive as que o client do Supabase faz por baixo dos
// panos. Sem isto, o /mapa podia continuar mostrando uma versão antiga dos
// dados depois de uma edição (foi o que causou "editei um apoiador e o
// outro sumiu do mapa" — não era o pin escondendo o outro, era o Next
// servindo uma leitura desatualizada do banco). "force-dynamic" garante que
// esta página sempre busca os dados na hora, nunca de cache.
export const dynamic = "force-dynamic"

type SearchParams = { bairro?: string }

export default async function MapaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()

  const [leaders, supporters, leaderNeighborhoods, supporterNeighborhoods] =
    await Promise.all([
      listMapLeaders(supabase, { neighborhood: params.bairro }),
      listMapSupporters(supabase, { neighborhood: params.bairro }),
      listDistinctLeaderNeighborhoods(supabase),
      listDistinctSupporterNeighborhoods(supabase),
    ])

  const neighborhoods = Array.from(
    new Set([...leaderNeighborhoods, ...supporterNeighborhoods]),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Mapa Territorial</h1>
        <p className="text-sm text-foreground/60">
          {leaders.length} liderança(s) e {supporters.length} apoiador(es) com
          localização cadastrada{params.bairro ? ` em ${params.bairro}` : ""}.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <form className="flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
          <select name="bairro" defaultValue={params.bairro ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
            <option value="">Todos os bairros</option>
            {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            Filtrar
          </button>
        </form>

        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-black/5 bg-white px-4 py-3 text-xs text-foreground/70">
          <span className="font-medium text-foreground">Lideranças:</span>
          {Object.entries(LEADER_STATUS_LABELS).map(([status, label]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_COLOR_HEX[LEADER_STATUS_COLOR[status as keyof typeof LEADER_STATUS_COLOR]] }}
              />
              {label}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-black/5 bg-white px-4 py-3 text-xs text-foreground/70">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SUPPORTER_PIN_COLOR }} />
            <span className="font-medium text-foreground">Apoiadores</span>
          </span>
        </div>
      </div>

      {leaders.length === 0 && supporters.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-black/5 bg-white text-sm text-foreground/50">
          Nenhum registro com latitude/longitude cadastrada ainda
          {params.bairro ? " neste bairro" : ""}.
        </div>
      ) : (
        <TerritoryMapLoader leaders={leaders} supporters={supporters} />
      )}
    </div>
  )
}
