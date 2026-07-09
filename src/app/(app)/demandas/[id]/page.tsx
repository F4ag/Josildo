import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getDemandById, getDemandHistory } from "@/services/demands"
import {
  DEMAND_STATUS_LABELS, DEMAND_STATUS_COLOR, DEMAND_TYPE_LABELS, PRIORITY_LABELS,
  type DemandStatus, type DemandType, type Priority, type UserRole,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { can } from "@/lib/permissions"
import { StatusUpdateForm } from "../status-update-form"

export const metadata: Metadata = { title: "Demanda · Lidera+" }

export default async function DemandaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [demand, history, session] = await Promise.all([
    getDemandById(supabase, id),
    getDemandHistory(supabase, id),
    getSessionUser(),
  ])

  if (!demand) notFound()

  const role = session?.profile.role as UserRole
  const canUpdateStatus = can(role, "update_status", "demands")

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{demand.title}</h1>
          {demand.demand_type && (
            <p className="text-sm text-foreground/60">{DEMAND_TYPE_LABELS[demand.demand_type as DemandType]}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={DEMAND_STATUS_COLOR[demand.status as DemandStatus]}>
            {DEMAND_STATUS_LABELS[demand.status as DemandStatus]}
          </Badge>
          <Badge tone="cinza">{PRIORITY_LABELS[demand.priority as Priority]}</Badge>
        </div>
      </div>

      <div className="grid gap-6 rounded-lg border border-black/5 bg-white p-6 sm:grid-cols-2">
        {demand.description && (
          <div className="sm:col-span-2">
            <Info label="Descrição" value={demand.description} />
          </div>
        )}
        <Info label="Bairro" value={demand.neighborhood} />
        <Info label="Endereço" value={demand.address} />
        <Info label="Órgão responsável" value={demand.public_agency} />
        <Info label="Prazo" value={demand.due_date} />
        <div>
          <p className="text-xs uppercase text-foreground/50">Liderança solicitante</p>
          {demand.leaders ? (
            <Link href={`/liderancas/${demand.leaders.id}`} className="text-sm text-secondary hover:underline">
              {demand.leaders.name}
            </Link>
          ) : (
            <p className="text-sm text-foreground">—</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase text-foreground/50">Pessoa relacionada</p>
          {demand.supporters ? (
            <Link href={`/apoiadores/${demand.supporters.id}`} className="text-sm text-secondary hover:underline">
              {demand.supporters.name}
            </Link>
          ) : (
            <p className="text-sm text-foreground">—</p>
          )}
        </div>
        {demand.result_description && (
          <div className="sm:col-span-2">
            <Info label="Resultado final" value={demand.result_description} />
          </div>
        )}
      </div>

      {canUpdateStatus && <StatusUpdateForm demandId={id} currentStatus={demand.status as DemandStatus} />}

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Histórico de atualizações</p>
        <ul className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="rounded-md border border-black/5 bg-white p-3 text-sm">
              <span className="font-medium">{DEMAND_STATUS_LABELS[h.status as DemandStatus] ?? h.status}</span>
              {h.comment && <span className="text-foreground/70"> — {h.comment}</span>}
              <p className="mt-1 text-xs text-foreground/40">
                {new Date(h.created_at).toLocaleString("pt-BR")}
              </p>
            </li>
          ))}
          {history.length === 0 && <p className="text-sm text-foreground/50">Sem histórico ainda.</p>}
        </ul>
      </div>
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
