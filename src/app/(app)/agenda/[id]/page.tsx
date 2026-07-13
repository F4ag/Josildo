import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getAgendaEventById } from "@/services/agenda"
import {
  AGENDA_STATUS_LABELS, AGENDA_STATUS_COLOR, type AgendaStatus, type UserRole,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { can } from "@/lib/permissions"
import { StatusUpdateForm } from "../status-update-form"

export const metadata: Metadata = { title: "Compromisso · Lidera+" }

export default async function CompromissoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [event, session] = await Promise.all([
    getAgendaEventById(supabase, id),
    getSessionUser(),
  ])

  if (!event) notFound()

  const role = session?.profile.role as UserRole
  const canUpdateStatus = can(role, "update", "agenda_events")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold text-foreground">{event.title}</h1>
          <p className="text-sm text-foreground/60">
            {new Date(`${event.event_date}T00:00:00`).toLocaleDateString("pt-BR")}
            {event.event_time && ` às ${event.event_time.slice(0, 5)}`}
          </p>
        </div>
        <Badge tone={AGENDA_STATUS_COLOR[event.status as AgendaStatus]}>
          {AGENDA_STATUS_LABELS[event.status as AgendaStatus]}
        </Badge>
      </div>

      <div className="grid gap-6 rounded-lg border border-black/5 bg-white p-6 sm:grid-cols-2">
        {event.description && (
          <div className="sm:col-span-2">
            <Info label="Descrição" value={event.description} />
          </div>
        )}
        <Info label="Local" value={event.location} />
        <Info label="Bairro" value={event.neighborhood} />
        <div>
          <p className="text-xs uppercase text-foreground/50">Liderança relacionada</p>
          {event.leaders ? (
            <Link href={`/liderancas/${event.leaders.id}`} className="text-sm text-secondary hover:underline">
              {event.leaders.name}
            </Link>
          ) : (
            <p className="text-sm text-foreground">—</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase text-foreground/50">Pessoa relacionada</p>
          {event.supporters ? (
            <Link href={`/apoiadores/${event.supporters.id}`} className="text-sm text-secondary hover:underline">
              {event.supporters.name}
            </Link>
          ) : (
            <p className="text-sm text-foreground">—</p>
          )}
        </div>
        {event.notes && (
          <div className="sm:col-span-2">
            <Info label="Observações" value={event.notes} />
          </div>
        )}
      </div>

      {canUpdateStatus && <StatusUpdateForm eventId={id} currentStatus={event.status as AgendaStatus} />}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase text-foreground/50">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  )
}
