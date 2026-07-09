import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getSupporterById } from "@/services/supporters"
import { SUPPORTER_ORIGIN_LABELS, type SupporterOrigin, type UserRole } from "@/types/domain"
import { WhatsAppButton } from "@/components/whatsapp-button"
import { can } from "@/lib/permissions"

export const metadata: Metadata = { title: "Apoiador · Lidera+" }

export default async function ApoiadorDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [supporter, session] = await Promise.all([getSupporterById(supabase, id), getSessionUser()])

  if (!supporter) notFound()

  const [{ count: demandCount }, { count: attendanceCount }] = await Promise.all([
    supabase.from("demands").select("id", { count: "exact", head: true }).eq("supporter_id", id),
    supabase.from("attendances").select("id", { count: "exact", head: true }).eq("supporter_id", id),
  ])

  const role = session?.profile.role as UserRole
  const isOwnNetwork = role === "lideranca" && supporter.leader_id === session?.profile.leader_id
  const canEdit = can(role, "update", "supporters") || isOwnNetwork
  const isPessoaAtendida = (demandCount ?? 0) > 0 || (attendanceCount ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold text-foreground">{supporter.name}</h1>
        {canEdit && (
          <Link href={`/apoiadores/${id}/editar`}
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5">
            Editar
          </Link>
        )}
      </div>

      {isPessoaAtendida && (
        <p className="rounded-md bg-secondary/10 px-3 py-2 text-sm text-secondary">
          Esta pessoa já tem {demandCount ?? 0} demanda(s) e {attendanceCount ?? 0} atendimento(s) registrados —
          o histórico completo (Módulo 5, "Pessoa Atendida") entra na Etapa 3 do plano de MVP.
        </p>
      )}

      <div className="grid gap-6 rounded-lg border border-black/5 bg-white p-6 sm:grid-cols-2">
        <Info label="WhatsApp" value={supporter.phone} />
        <Info label="E-mail" value={supporter.email} />
        <Info label="Data de nascimento" value={supporter.birth_date} />
        <Info label="Bairro" value={supporter.neighborhood} />
        <Info label="Endereço" value={supporter.address} />
        <Info label="Origem do cadastro" value={supporter.origin ? SUPPORTER_ORIGIN_LABELS[supporter.origin as SupporterOrigin] : null} />
        <Info label="Profissão" value={supporter.profession} />
        <Info label="Consentimento WhatsApp" value={supporter.consent_whatsapp ? "Sim" : "Não"} />
        <Info label="Consentimento e-mail" value={supporter.consent_email ? "Sim" : "Não"} />
        {supporter.notes && (
          <div className="sm:col-span-2">
            <Info label="Observações" value={supporter.notes} />
          </div>
        )}
      </div>

      <WhatsAppButton phone={supporter.phone} message={`Olá, ${supporter.name}!`} consentWhatsapp={supporter.consent_whatsapp} />
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
