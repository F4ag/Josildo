import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getSupporterById } from "@/services/supporters"
import { getPollingLocationById, formatPollingLocationLabel } from "@/services/polling-locations"
import { SUPPORTER_ORIGIN_LABELS, type SupporterOrigin, type UserRole } from "@/types/domain"
import { WhatsAppButton } from "@/components/whatsapp-button"
import { DeleteButton } from "@/components/delete-button"
import { can } from "@/lib/permissions"
import { deleteSupporterAction, promoteSupporterToLeaderAction } from "../actions"

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

  const [{ count: demandCount }, { count: attendanceCount }, pollingLocation] = await Promise.all([
    supabase.from("demands").select("id", { count: "exact", head: true }).eq("supporter_id", id),
    supabase.from("attendances").select("id", { count: "exact", head: true }).eq("supporter_id", id),
    supporter.polling_location_id ? getPollingLocationById(supabase, supporter.polling_location_id) : Promise.resolve(null),
  ])

  const role = session?.profile.role as UserRole
  const isOwnNetwork = role === "lideranca" && supporter.leader_id === session?.profile.leader_id
  const canEdit = can(role, "update", "supporters") || isOwnNetwork
  const canDelete = can(role, "delete", "supporters")
  // Transformar em liderança é ação sensível o bastante (cria cadastro novo
  // e pode apagar o de apoiador) pra reservar só ao Admin Geral, mesmo
  // quando admin_equipe já pode editar/cadastrar apoiadores normalmente.
  const canPromote = role === "admin_geral"
  // Mesma restrição da rota /relatorios (ADMIN_ONLY_ROUTE_PREFIXES em
  // lib/permissions.ts) — sem isso o botão apareceria pra liderança, que
  // não tem acesso a /relatorios/ficha-individual/pdf (403).
  const canGenerateReports = can(role, "generate_reports")
  const isPessoaAtendida = (demandCount ?? 0) > 0 || (attendanceCount ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="min-w-0 break-words text-xl font-semibold text-foreground">{supporter.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Link href={`/apoiadores/${id}/editar`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5">
              Editar
            </Link>
          )}
          {canGenerateReports && (
            <Link href={`/relatorios/ficha-individual/pdf?tipo=apoiador&id=${id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5">
              <Download className="h-4 w-4" aria-hidden />
              Baixar ficha em PDF
            </Link>
          )}
          {canPromote && (
            <DeleteButton
              action={promoteSupporterToLeaderAction.bind(null, id)}
              label="Transformar em liderança"
              tone="primary"
              confirmMessage={
                isPessoaAtendida
                  ? `${supporter.name} vira um cadastro de liderança novo. Como já tem ${demandCount ?? 0} demanda(s)/${attendanceCount ?? 0} atendimento(s) vinculados, o cadastro de apoiador original vai ser mantido (não pode ser apagado com histórico vinculado). Continuar?`
                  : `${supporter.name} vira um cadastro de liderança novo, e o cadastro de apoiador original será removido. Continuar?`
              }
            />
          )}
          {canDelete && (
            <DeleteButton
              action={deleteSupporterAction.bind(null, id)}
              confirmMessage={
                isPessoaAtendida
                  ? `${supporter.name} tem ${demandCount ?? 0} demanda(s) e ${attendanceCount ?? 0} atendimento(s) vinculados — a exclusão vai ser recusada até esses vínculos serem removidos. Tentar mesmo assim?`
                  : `Tem certeza que deseja excluir ${supporter.name}? Essa ação não pode ser desfeita.`
              }
            />
          )}
        </div>
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
        <Info label="CPF" value={supporter.cpf} />
        <Info label="Nome da mãe" value={supporter.mother_name} />
        <Info label="Bairro" value={supporter.neighborhood} />
        <Info label="Endereço" value={supporter.address} />
        <Info label="Complemento" value={supporter.complement} />
        <Info label="Local de votação" value={pollingLocation ? formatPollingLocationLabel(pollingLocation) : null} />
        <Info label="Zona eleitoral" value={supporter.electoral_zone} />
        <Info label="Seção eleitoral" value={supporter.electoral_section} />
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
