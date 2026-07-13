import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLeaderById } from "@/services/leaders"
import {
  LEADER_STATUS_LABELS, LEADER_STATUS_COLOR, LEADER_TYPE_LABELS, INFLUENCE_LEVEL_LABELS,
  type LeaderStatus, type LeaderType, type InfluenceLevel, type UserRole,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { WhatsAppButton } from "@/components/whatsapp-button"
import { DeleteButton } from "@/components/delete-button"
import { can } from "@/lib/permissions"
import { deleteLeaderAction } from "../actions"

export const metadata: Metadata = { title: "Liderança · Lidera+" }

export default async function LiderancaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [leader, session] = await Promise.all([getLeaderById(supabase, id), getSessionUser()])

  // Se a RLS filtrou a linha (liderança tentando ver outra rede), o service
  // retorna null — trate como 404, não como erro de permissão explícito,
  // para não vazar se o registro existe ou não.
  if (!leader) notFound()

  const [{ count: supporterCount }, { count: demandCount }, { data: subordinates }, parentLeader] = await Promise.all([
    supabase.from("supporters").select("id", { count: "exact", head: true }).eq("leader_id", id),
    supabase.from("demands").select("id", { count: "exact", head: true }).eq("leader_id", id),
    supabase.from("leaders").select("id, name, status").eq("parent_leader_id", id).order("name", { ascending: true }),
    leader.parent_leader_id ? getLeaderById(supabase, leader.parent_leader_id) : Promise.resolve(null),
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
  const hasLinkedRecords = (supporterCount ?? 0) > 0 || (demandCount ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{leader.name}</h1>
          {leader.nickname && <p className="text-sm text-foreground/60">&quot;{leader.nickname}&quot;</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={LEADER_STATUS_COLOR[leader.status as LeaderStatus]}>
            {LEADER_STATUS_LABELS[leader.status as LeaderStatus]}
          </Badge>
          {canEdit && (
            <Link href={`/liderancas/${id}/editar`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5">
              Editar
            </Link>
          )}
          {canDelete && (
            <DeleteButton
              action={deleteLeaderAction.bind(null, id)}
              confirmMessage={
                hasLinkedRecords
                  ? `${leader.name} tem ${supporterCount ?? 0} apoiador(es) e ${demandCount ?? 0} demanda(s) vinculados — a exclusão vai ser recusada até esses vínculos serem removidos ou transferidos. Tentar mesmo assim?`
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
        <Info label="Tipo" value={leader.leader_type ? LEADER_TYPE_LABELS[leader.leader_type as LeaderType] : null} />
        <Info
          label="Nível de influência"
          value={leader.influence_level ? INFLUENCE_LEVEL_LABELS[leader.influence_level as InfluenceLevel] : null}
        />
        <Info label="E-mail" value={leader.email} />
        <Info label="Data de nascimento" value={leader.birth_date} />
        <Info label="Pode ver atendimentos da rede?" value={leader.can_view_attendances ? "Sim" : "Não"} />
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
