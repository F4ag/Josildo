import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getPessoaAtendidaDetail } from "@/services/pessoas-atendidas"
import {
  DEMAND_STATUS_LABELS, DEMAND_STATUS_COLOR, ATTENDANCE_STATUS_LABELS,
  INTERACTION_TYPE_LABELS, type DemandStatus, type AttendanceStatus, type InteractionType,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { WhatsAppButton } from "@/components/whatsapp-button"

export const metadata: Metadata = { title: "Pessoa Atendida · Lidera+" }

export default async function PessoaAtendidaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const detail = await getPessoaAtendidaDetail(supabase, id)

  if (!detail) notFound()
  const { supporter, demands, attendances, interactions } = detail

  const resolvedCount = demands.filter((d) => d.status === "resolvida").length
  const attendedCount = attendances.filter((a) => a.status === "atendido").length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{supporter.name}</h1>
          <p className="text-sm text-foreground/60">
            {supporter.neighborhood ?? "Sem bairro"}
            {supporter.leaders ? ` · Rede de ${supporter.leaders.name}` : ""}
          </p>
        </div>
        <WhatsAppButton phone={supporter.phone} message={`Olá, ${supporter.name}!`} consentWhatsapp={supporter.consent_whatsapp} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Demandas solicitadas" value={demands.length} />
        <StatCard label="Demandas resolvidas" value={resolvedCount} />
        <StatCard label="Atendimentos recebidos" value={attendances.length} />
        <StatCard label="Atendimentos concluídos" value={attendedCount} />
      </div>

      <Tabs
        tabs={[
          {
            label: "Dados pessoais",
            content: (
              <div className="grid gap-6 rounded-lg border border-black/5 bg-white p-6 sm:grid-cols-2">
                <Info label="WhatsApp" value={supporter.phone} />
                <Info label="E-mail" value={supporter.email} />
                <Info label="Endereço" value={supporter.address} />
                <Info label="Data de nascimento" value={supporter.birth_date} />
                <Info label="Liderança vinculada" value={supporter.leaders?.name} />
              </div>
            ),
          },
          {
            label: "Demandas",
            badge: demands.length,
            content: (
              <ul className="space-y-2">
                {demands.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-md border border-black/5 bg-white p-3">
                    <Link href={`/demandas/${d.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {d.title}
                    </Link>
                    <Badge tone={DEMAND_STATUS_COLOR[d.status as DemandStatus]}>
                      {DEMAND_STATUS_LABELS[d.status as DemandStatus]}
                    </Badge>
                  </li>
                ))}
                {demands.length === 0 && <p className="text-sm text-foreground/50">Nenhuma demanda registrada.</p>}
              </ul>
            ),
          },
          {
            label: "Atendimentos",
            badge: attendances.length,
            content: (
              <ul className="space-y-2">
                {attendances.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-md border border-black/5 bg-white p-3">
                    <Link href={`/atendimentos/${a.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {a.title}
                    </Link>
                    <Badge tone="azul">{ATTENDANCE_STATUS_LABELS[a.status as AttendanceStatus]}</Badge>
                  </li>
                ))}
                {attendances.length === 0 && <p className="text-sm text-foreground/50">Nenhum atendimento registrado.</p>}
              </ul>
            ),
          },
          {
            label: "Interações",
            badge: interactions.length,
            content: (
              <ul className="space-y-2">
                {interactions.map((i) => (
                  <li key={i.id} className="rounded-md border border-black/5 bg-white p-3 text-sm">
                    <span className="font-medium">
                      {INTERACTION_TYPE_LABELS[i.interaction_type as InteractionType] ?? i.interaction_type}
                    </span>
                    {i.description && <span className="text-foreground/70"> — {i.description}</span>}
                    <p className="mt-1 text-xs text-foreground/40">
                      {new Date(i.created_at).toLocaleString("pt-BR")}
                    </p>
                  </li>
                ))}
                {interactions.length === 0 && <p className="text-sm text-foreground/50">Sem interações registradas.</p>}
              </ul>
            ),
          },
        ]}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/5 bg-white p-4">
      <p className="text-xs uppercase text-foreground/50">{label}</p>
      <p className="text-2xl font-semibold text-primary">{value}</p>
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
