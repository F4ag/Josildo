import Link from "next/link"
import type { Metadata } from "next"
import { ClipboardList, AlertCircle, Clock, CheckCircle2 } from "lucide-react"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listDemands, listDistinctDemandNeighborhoods, getDemandStatusCounts } from "@/services/demands"
import {
  DEMAND_STATUSES, DEMAND_STATUS_LABELS, DEMAND_STATUS_COLOR, DEMAND_TYPES, DEMAND_TYPE_LABELS,
  PRIORITIES, PRIORITY_LABELS, type DemandStatus, type DemandType, type Priority, type UserRole,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/dashboard/stat-card"
import { can } from "@/lib/permissions"

export const metadata: Metadata = { title: "Demandas · Lidera+" }

type SearchParams = {
  bairro?: string; status?: DemandStatus; tipo?: DemandType; prioridade?: Priority; busca?: string
}

export default async function DemandasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const session = await getSessionUser()
  const supabase = await createClient()
  const role = session?.profile.role as UserRole

  // Não aplicamos filtro extra de leaderId para o perfil "lideranca": a RLS
  // (dm_lideranca_select_own) já libera demandas por leader_id OU por
  // supporter_id da própria rede — filtrar aqui por leader_id excluiria
  // indevidamente as demandas ligadas só via supporter_id.
  const [demands, neighborhoods, statusCounts] = await Promise.all([
    listDemands(supabase, {
      neighborhood: params.bairro,
      status: params.status,
      demandType: params.tipo,
      priority: params.prioridade,
      search: params.busca,
    }),
    listDistinctDemandNeighborhoods(supabase),
    getDemandStatusCounts(supabase),
  ])

  const canCreate = can(role, "create", "demands")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Demandas</h1>
          <p className="text-sm text-foreground/60">{demands.length} com os filtros atuais.</p>
        </div>
        {canCreate && (
          <Link href="/demandas/nova"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Nova demanda
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={statusCounts.total} icon={ClipboardList} tone="primary" />
        <StatCard label="Atrasadas" value={statusCounts.atrasadas} icon={AlertCircle} tone="danger" />
        <StatCard label="Em andamento" value={statusCounts.emAndamento} href="/demandas?status=em_andamento" icon={Clock} tone="orange" />
        <StatCard label="Resolvidas (mês)" value={statusCounts.resolvidasMes} href="/demandas?status=resolvida" icon={CheckCircle2} tone="secondary" />
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
        <input type="search" name="busca" defaultValue={params.busca} placeholder="Buscar por título..."
          className="min-w-48 flex-1 rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        <select name="bairro" defaultValue={params.bairro ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todos os bairros</option>
          {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todo status</option>
          {DEMAND_STATUSES.map((s) => <option key={s} value={s}>{DEMAND_STATUS_LABELS[s]}</option>)}
        </select>
        <select name="tipo" defaultValue={params.tipo ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todo tipo</option>
          {DEMAND_TYPES.map((t) => <option key={t} value={t}>{DEMAND_TYPE_LABELS[t]}</option>)}
        </select>
        <select name="prioridade" defaultValue={params.prioridade ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Toda prioridade</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          Filtrar
        </button>
      </form>

      {demands.length === 0 ? (
        <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
          Nenhuma demanda encontrada.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:hidden">
            {demands.map((d) => (
              <Link key={d.id} href={`/demandas/${d.id}`} className="block rounded-lg border border-black/5 bg-white p-4 hover:border-primary/30">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{d.title}</p>
                  <Badge tone={DEMAND_STATUS_COLOR[d.status as DemandStatus]}>
                    {DEMAND_STATUS_LABELS[d.status as DemandStatus]}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/60">
                  {d.neighborhood ?? "Sem bairro"} · {d.leaders?.name ?? d.supporters?.name ?? "—"}
                </p>
                <p className="text-xs text-foreground/50">Prioridade: {PRIORITY_LABELS[d.priority as Priority]}</p>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
                <tr>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Bairro</th>
                  <th className="px-4 py-3">Liderança / Pessoa</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {demands.map((d) => (
                  <tr key={d.id} className="border-t border-black/5">
                    <td className="px-4 py-3">
                      <Link href={`/demandas/${d.id}`} className="font-medium text-foreground hover:text-primary">
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{d.neighborhood ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground/70">
                      {d.leaders?.name ?? d.supporters?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{PRIORITY_LABELS[d.priority as Priority]}</td>
                    <td className="px-4 py-3">
                      <Badge tone={DEMAND_STATUS_COLOR[d.status as DemandStatus]}>
                        {DEMAND_STATUS_LABELS[d.status as DemandStatus]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
