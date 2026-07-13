import Link from "next/link"
import type { Metadata } from "next"
import { Users, UserCheck, AlertTriangle, UserX } from "lucide-react"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  listLeaders, listDistinctLeaderNeighborhoods, listDistinctLeaderCities, getLeaderStatusCounts,
} from "@/services/leaders"
import {
  LEADER_TYPES, LEADER_TYPE_LABELS, INFLUENCE_LEVELS, INFLUENCE_LEVEL_LABELS,
  LEADER_STATUSES, LEADER_STATUS_LABELS, LEADER_STATUS_COLOR,
  type LeaderType, type LeaderStatus, type InfluenceLevel, type UserRole,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/dashboard/stat-card"
import { WhatsAppButton } from "@/components/whatsapp-button"
import { can } from "@/lib/permissions"

export const metadata: Metadata = { title: "Lideranças · Lidera+" }

type SearchParams = {
  bairro?: string
  cidade?: string
  tipo?: LeaderType
  status?: LeaderStatus
  influencia?: InfluenceLevel
  busca?: string
}

export default async function LiderancasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const session = await getSessionUser()
  const supabase = await createClient()

  const [leaders, neighborhoods, cities, statusCounts] = await Promise.all([
    listLeaders(supabase, {
      neighborhood: params.bairro,
      city: params.cidade,
      leaderType: params.tipo,
      status: params.status,
      influenceLevel: params.influencia,
      search: params.busca,
    }),
    listDistinctLeaderNeighborhoods(supabase),
    listDistinctLeaderCities(supabase),
    getLeaderStatusCounts(supabase),
  ])

  const role = session?.profile.role as UserRole
  const canCreate = can(role, "create", "leaders")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Lideranças</h1>
          <p className="text-sm text-foreground/60">{leaders.length} cadastradas com os filtros atuais.</p>
        </div>
        {canCreate && (
          <Link href="/liderancas/novo"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Nova liderança
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={statusCounts.total} icon={Users} tone="primary" />
        <StatCard label="Ativas" value={statusCounts.ativa} href="/liderancas?status=ativa" icon={UserCheck} tone="secondary" />
        <StatCard label="Em atenção" value={statusCounts.em_atencao} href="/liderancas?status=em_atencao" icon={AlertTriangle} tone="accent" />
        <StatCard label="Inativas" value={statusCounts.inativa} href="/liderancas?status=inativa" icon={UserX} tone="danger" />
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
        <input type="search" name="busca" defaultValue={params.busca} placeholder="Buscar por nome..."
          className="min-w-48 flex-1 rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        <select name="bairro" defaultValue={params.bairro ?? ""}
          className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todos os bairros</option>
          {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select name="cidade" defaultValue={params.cidade ?? ""}
          className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todas as cidades</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="tipo" defaultValue={params.tipo ?? ""}
          className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todos os tipos</option>
          {LEADER_TYPES.map((t) => <option key={t} value={t}>{LEADER_TYPE_LABELS[t]}</option>)}
        </select>
        <select name="status" defaultValue={params.status ?? ""}
          className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {LEADER_STATUSES.map((s) => <option key={s} value={s}>{LEADER_STATUS_LABELS[s]}</option>)}
        </select>
        <select name="influencia" defaultValue={params.influencia ?? ""}
          className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Toda influência</option>
          {INFLUENCE_LEVELS.map((l) => <option key={l} value={l}>{INFLUENCE_LEVEL_LABELS[l]}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          Filtrar
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {leaders.map((leader) => (
          // Nota: não aninhar <a> dentro de <a> — o Link cobre só o bloco de
          // texto; o botão de WhatsApp fica fora dele, como irmão, no mesmo card.
          <div key={leader.id} className="rounded-lg border border-black/5 bg-white p-4 hover:border-primary/30">
            <Link href={`/liderancas/${leader.id}`} className="block">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{leader.name}</p>
                <Badge tone={LEADER_STATUS_COLOR[leader.status as LeaderStatus]}>
                  {LEADER_STATUS_LABELS[leader.status as LeaderStatus]}
                </Badge>
              </div>
              <p className="text-sm text-foreground/60">
                {leader.neighborhood ?? "Sem bairro"}
                {leader.city ? ` · ${leader.city}` : ""}
              </p>
              {leader.leader_type && (
                <p className="text-xs text-foreground/50">{LEADER_TYPE_LABELS[leader.leader_type as LeaderType]}</p>
              )}
            </Link>
            <div className="mt-3">
              <WhatsAppButton phone={leader.phone} message={`Olá, ${leader.name}!`} />
            </div>
          </div>
        ))}
        {leaders.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-foreground/50">
            Nenhuma liderança encontrada com esses filtros.
          </p>
        )}
      </div>
    </div>
  )
}
