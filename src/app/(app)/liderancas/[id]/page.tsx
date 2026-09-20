import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { headers } from "next/headers"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLeaderById } from "@/services/leaders"
import { buildLeaderAccessLink, getLeaderAccessToken } from "@/services/leader-access"
import { getPollingLocationById, formatPollingLocationLabel } from "@/services/polling-locations"
import {
  LEADER_STATUS_LABELS, LEADER_STATUS_COLOR, LEADER_TYPE_LABELS, INFLUENCE_LEVEL_LABELS,
  type LeaderStatus, type LeaderType, type InfluenceLevel, type UserRole,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { WhatsAppButton } from "@/components/whatsapp-button"
import { DeleteButton } from "@/components/delete-button"
import { can } from "@/lib/permissions"
import { deleteLeaderAction, generateLeaderAccessLinkAction, revokeLeaderAccessAction } from "../actions"

export const metadata: Metadata = { title: "Liderança · Lidera+" }

export default async function LiderancaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ promovido?: string; apoiador_mantido?: string; erro_link?: string }>
}) {
  const { id } = await params
  const { promovido, apoiador_mantido: apoiadorMantido, erro_link: erroLink } = await searchParams
  const supabase = await createClient()
  const [leader, session] = await Promise.all([getLeaderById(supabase, id), getSessionUser()])

  // Se a RLS filtrou a linha (liderança tentando ver outra rede), o service
  // retorna null — trate como 404, não como erro de permissão explícito,
  // para não vazar se o registro existe ou não.
  if (!leader) notFound()

  const [{ count: supporterCount }, { count: demandCount }, { data: subordinates }, parentLeader, pollingLocation] = await Promise.all([
    supabase.from("supporters").select("id", { count: "exact", head: true }).eq("leader_id", id),
    supabase.from("demands").select("id", { count: "exact", head: true }).eq("leader_id", id),
    supabase.from("leaders").select("id, name, status").eq("parent_leader_id", id).order("name", { ascending: true }),
    leader.parent_leader_id ? getLeaderById(supabase, leader.parent_leader_id) : Promise.resolve(null),
    leader.polling_location_id ? getPollingLocationById(supabase, leader.polling_location_id) : Promise.resolve(null),
  ])

  const role = session?.profile.role as UserRole
  const isOwnRecord = role === "lideranca" && session?.profile.leader_id === id
  // Liderança só edita o próprio cadastro (a RLS ld_lideranca_update_self só
  // cobre isso) — mesmo que ela agora veja sub-lideranças que cadastrou
  // (ld_lideranca_select_subordinates), não existe policy de update pra
  // elas. Por isso não usar can(role, "update", "leaders") sozinho aqui: o
  // valor "true" na matriz pra lideranca é só o teto de UX, condicionado a
  // isOwnRecord — sem isso o botão Editar apareceria numa página que o
  // submit real (RLS) recusaria.
  const canEdit = role === "lideranca" ? isOwnRecord : can(role, "update", "leaders")
  const canDelete = can(role, "delete", "leaders")
  const canGenerateReports = can(role, "generate_reports")
  const hasLinkedRecords = (supporterCount ?? 0) > 0 || (demandCount ?? 0) > 0

  const host = (await headers()).get("host") ?? ""
  // leader_access_tokens tem RLS ativa e nenhuma policy, então nem o client
  // de sessão do admin_geral lê essa tabela — a leitura passa pelo client
  // administrativo, autorizada pela checagem de role logo acima (mesmo
  // contrato das Server Actions de acesso). Só busca pra admin_geral: é o
  // único perfil que vê o bloco "Acesso ao sistema" mais abaixo.
  const accessToken = role === "admin_geral" ? await getLeaderAccessToken(createAdminClient(), id) : null
  const accessLink = accessToken ? buildLeaderAccessLink(host, accessToken) : null
  const accessMessage = accessLink
    ? `Oi, ${leader.name}! Aqui está seu acesso ao Lidera+: ${accessLink}\nÉ só clicar para entrar — não precisa de senha.`
    : ""

  return (
    <div className="space-y-6">
      {promovido === "1" && (
        <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary">
          {leader.name} foi transformado(a) de apoiador(a) em liderança.
          {apoiadorMantido === "1"
            ? " Como já tinha demanda(s)/atendimento(s) vinculados, o cadastro de apoiador original foi mantido — os dois cadastros existem em paralelo."
            : " O cadastro de apoiador original foi removido."}
          {" "}Complete o cadastro abaixo com tipo de liderança, nível de influência e expectativa de votos.
        </div>
      )}
      {erroLink === "1" && (
        <div className="rounded-lg border border-status-atrasada/30 bg-status-atrasada/10 p-4 text-sm text-status-atrasada">
          {leader.name} foi cadastrada, mas não foi possível gerar o link de acesso automaticamente. Gere
          manualmente no bloco &quot;Acesso ao sistema&quot; abaixo.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground break-words">{leader.name}</h1>
          {leader.nickname && <p className="text-sm text-foreground/60">&quot;{leader.nickname}&quot;</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={LEADER_STATUS_COLOR[leader.status as LeaderStatus]}>
            {LEADER_STATUS_LABELS[leader.status as LeaderStatus]}
          </Badge>
          {canEdit && (
            <Link href={`/liderancas/${id}/editar`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5">
              Editar
            </Link>
          )}
          {canGenerateReports && (
            <Link href={`/relatorios/ficha-individual/pdf?tipo=lideranca&id=${id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5">
              <Download className="h-4 w-4" aria-hidden />
              Baixar ficha em PDF
            </Link>
          )}
          {canDelete && (
            <DeleteButton
              action={deleteLeaderAction.bind(null, id)}
              confirmMessage={
                hasLinkedRecords
                  ? `${leader.name} tem ${supporterCount ?? 0} apoiador(es) e ${demandCount ?? 0} demanda(s) vinculados — a exclusão vai ser recusada até esses vínculos serem removidos ou transferidos. Tentar mesmo assim?`
                  : leader.user_id
                    ? `Tem certeza que deseja excluir ${leader.name}? O acesso de login dela também será excluído. Essa ação não pode ser desfeita.`
                    : `Tem certeza que deseja excluir ${leader.name}? Essa ação não pode ser desfeita.`
              }
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Apoiadores na rede</p>
          <p className="text-2xl font-semibold text-primary">{supporterCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Demandas solicitadas</p>
          <p className="text-2xl font-semibold text-primary">{demandCount ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-6 rounded-lg border border-black/5 bg-white p-6 sm:grid-cols-2">
        <Info label="Bairro" value={leader.neighborhood} />
        <Info label="Cidade" value={[leader.city, leader.state].filter(Boolean).join(" / ") || null} />
        <Info label="Endereço" value={leader.address} />
        <Info label="Complemento" value={leader.complement} />
        <Info label="Local de votação" value={pollingLocation ? formatPollingLocationLabel(pollingLocation) : null} />
        <Info label="Zona eleitoral" value={leader.electoral_zone} />
        <Info label="Seção eleitoral" value={leader.electoral_section} />
        <Info label="Tipo" value={leader.leader_type ? LEADER_TYPE_LABELS[leader.leader_type as LeaderType] : null} />
        <Info
          label="Nível de influência"
          value={leader.influence_level ? INFLUENCE_LEVEL_LABELS[leader.influence_level as InfluenceLevel] : null}
        />
        <Info label="E-mail" value={leader.email} />
        <Info label="Data de nascimento" value={leader.birth_date} />
        <Info label="CPF" value={leader.cpf} />
        <Info label="Nome da mãe" value={leader.mother_name} />
        <Info label="Pode ver atendimentos da rede?" value={leader.can_view_attendances ? "Sim" : "Não"} />
        <Info label="Expectativa de votos" value={leader.expected_votes != null ? String(leader.expected_votes) : null} />
        {/* Campo admin-only: nunca mostrar pra role lideranca, nem no próprio
            cadastro nem no de sub-lideranças que ela cadastrou — é a
            avaliação real do administrador, não algo que ela deveria ver.
            Mesma regra de acesso já aplicada em leader-form.tsx/actions.ts,
            mas ali é sobre edição — aqui é o primeiro campo desta página que
            também precisa ser escondido na leitura. */}
        {role !== "lideranca" && (
          <Info
            label="Expectativa de votos (avaliação do admin)"
            value={leader.admin_estimated_votes != null ? String(leader.admin_estimated_votes) : null}
          />
        )}
        {parentLeader && (
          <Info label="Cadastrada por" value={parentLeader.name} />
        )}
        {leader.notes && (
          <div className="sm:col-span-2">
            <Info label="Observações" value={leader.notes} />
          </div>
        )}
      </div>

      {subordinates && subordinates.length > 0 && (
        <div className="rounded-lg border border-black/5 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-foreground">
            Lideranças cadastradas por {leader.name} ({subordinates.length})
          </p>
          <ul className="space-y-2">
            {subordinates.map((sub) => (
              <li key={sub.id}>
                <Link href={`/liderancas/${sub.id}`} className="flex items-center justify-between gap-2 rounded-md border border-black/5 px-3 py-2 text-sm hover:border-primary/30">
                  <span className="font-medium text-foreground">{sub.name}</span>
                  <Badge tone={LEADER_STATUS_COLOR[sub.status as LeaderStatus]}>
                    {LEADER_STATUS_LABELS[sub.status as LeaderStatus]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {role === "admin_geral" && (
        <div className="rounded-lg border border-black/5 bg-white p-6">
          <p className="mb-1 text-sm font-medium text-foreground">Acesso ao sistema</p>
          {accessLink ? (
            <>
              <p className="mb-3 text-xs text-foreground/50">
                Link de acesso ativo — {leader.name} entra direto pelo link, sem senha.
              </p>
              {/* Sem telefone o WhatsAppButton não renderiza nada (ver
                  components/whatsapp-button.tsx) — sem esta caixa a
                  liderança ficaria com link gerado e impossível de entregar
                  (docs/08-acesso-lideranca-sem-senha.md §6). */}
              {!leader.phone && (
                <div className="mb-3">
                  <p className="mb-1 text-xs text-foreground/50">
                    {leader.name} não tem telefone cadastrado — copie o link abaixo e envie pelo canal que preferir.
                  </p>
                  <input
                    readOnly
                    value={accessLink}
                    aria-label={`Link de acesso de ${leader.name}`}
                    className="w-full rounded-md border border-black/10 px-3 py-2 text-xs text-foreground/70"
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <WhatsAppButton phone={leader.phone} message={accessMessage} label="Enviar link pelo WhatsApp" />
                <DeleteButton
                  action={revokeLeaderAccessAction.bind(null, id)}
                  label="Revogar acesso"
                  tone="danger"
                  confirmMessage={`Revogar o acesso de ${leader.name}? Isso bloqueia o login por completo — inclusive a senha antiga, se ela tiver uma —, o link atual para de funcionar e qualquer sessão aberta é encerrada em seguida.`}
                />
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-xs text-foreground/50">
                {leader.name} ainda não tem link de acesso — gere um para que ela entre no sistema sem senha.
              </p>
              <DeleteButton
                action={generateLeaderAccessLinkAction.bind(null, id)}
                label="Gerar link de acesso"
                tone="primary"
                confirmMessage={`Gerar um link de acesso para ${leader.name}?`}
              />
            </>
          )}
        </div>
      )}

      <WhatsAppButton phone={leader.phone} message={`Olá, ${leader.name}!`} />

      <p className="text-xs text-foreground/40">
        Apoiadores vinculados, demandas e histórico de interações entram na Etapa 3 do plano de MVP
        (docs/02-plano-mvp.md), como abas nesta mesma página.
      </p>
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
