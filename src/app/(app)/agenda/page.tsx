import Link from "next/link"
import type { Metadata } from "next"
import { CalendarClock, CalendarDays, CalendarRange, Hourglass } from "lucide-react"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listAgendaEvents, getAgendaEventCounts } from "@/services/agenda"
import { listDistinctSupporterNeighborhoods } from "@/services/supporters"
import {
  AGENDA_STATUSES, AGENDA_STATUS_LABELS, AGENDA_STATUS_COLOR, type AgendaStatus, type UserRole,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/dashboard/stat-card"
import { can } from "@/lib/permissions"

export const metadata: Metadata = { title: "Agenda · Lidera+" }

type SearchParams = { status?: AgendaStatus; bairro?: string }

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const session = await getSessionUser()
  const supabase = await createClient()
  const role = session?.profile.role as UserRole

  const [events, neighborhoods, counts] = await Promise.all([
    listAgendaEvents(supabase, {
      status: params.status,
      neighborhood: params.bairro,
      leaderId: role === "lideranca" ? session?.profile.leader_id ?? undefined : undefined,
    }),
    listDistinctSupporterNeighborhoods(supabase),
    getAgendaEventCounts(supabase),
  ])

  const canCreate = can(role, "create", "agenda_events")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Agenda</h1>
          <p className="text-sm text-foreground/60">{events.length} com os filtros atuais.</p>
        </div>
        {canCreate && (
          <Link href="/agenda/novo"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Novo compromisso
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={counts.total} icon={CalendarClock} tone="primary" />
        <StatCard label="Hoje" value={counts.hoje} icon={CalendarDays} tone="orange" />
        <StatCard label="Próximos 7 dias" value={counts.semana} icon={CalendarRange} tone="secondary" />
        <StatCard label="Pendentes" value={counts.pendentes} href="/agenda?status=pendente" icon={Hourglass} tone="accent" />
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
        <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todo status</option>
          {AGENDA_STATUSES.map((s) => <option key={s} value={s}>{AGENDA_STATUS_LABELS[s]}</option>)}
        </select>
        <select name="bairro" defaultValue={params.bairro ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todos os bairros</option>
          {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
            <tr>
              <th className="px-4 py-3">Compromisso</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Local / Bairro</th>
              <th className="px-4 py-3">Liderança / Pessoa</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-black/5">
                <td className="px-4 py-3">
                  <Link href={`/agenda/${e.id}`} className="font-medium text-foreground hover:text-primary">
                    {e.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/70">
                  {new Date(`${e.event_date}T00:00:00`).toLocaleDateString("pt-BR")}
                  {e.event_time && ` · ${e.event_time.slice(0, 5)}`}
                </td>
                <td className="px-4 py-3 text-foreground/70">{e.location ?? e.neighborhood ?? "—"}</td>
                <td className="px-4 py-3 text-foreground/70">
                  {e.leaders?.name ?? e.supporters?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={AGENDA_STATUS_COLOR[e.status as AgendaStatus]}>
                    {AGENDA_STATUS_LABELS[e.status as AgendaStatus]}
                  </Badge>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-foreground/50">Nenhum compromisso encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
