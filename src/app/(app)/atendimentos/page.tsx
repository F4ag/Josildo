import Link from "next/link"
import type { Metadata } from "next"
import { Stethoscope, Clock, CheckCircle2, XCircle } from "lucide-react"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listAttendances, getAttendanceStatusCounts } from "@/services/attendances"
import {
  ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS, ATTENDANCE_TYPES, ATTENDANCE_TYPE_LABELS,
  type AttendanceStatus, type AttendanceType, type UserRole,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/dashboard/stat-card"
import { can } from "@/lib/permissions"

export const metadata: Metadata = { title: "Atendimentos · Lidera+" }

type SearchParams = { status?: AttendanceStatus; tipo?: AttendanceType }

const STATUS_TONE: Record<AttendanceStatus, "cinza" | "laranja" | "verde" | "vermelho"> = {
  novo: "cinza", em_analise: "cinza", em_andamento: "laranja", aguardando_documento: "laranja",
  aguardando_orgao_publico: "laranja", atendido: "verde", nao_atendido: "vermelho",
  cancelado: "vermelho", arquivado: "cinza",
}

export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const session = await getSessionUser()
  const supabase = await createClient()
  const role = session?.profile.role as UserRole

  const [attendances, statusCounts] = await Promise.all([
    listAttendances(supabase, { status: params.status, attendanceType: params.tipo }),
    getAttendanceStatusCounts(supabase),
  ])
  const canCreate = can(role, "create", "attendances")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Atendimentos</h1>
          <p className="text-sm text-foreground/60">{attendances.length} com os filtros atuais.</p>
        </div>
        {canCreate && (
          <Link href="/atendimentos/novo"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Novo atendimento
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={statusCounts.total} icon={Stethoscope} tone="primary" />
        <StatCard label="Em aberto" value={statusCounts.emAberto} icon={Clock} tone="orange" />
        <StatCard label="Atendidos" value={statusCounts.atendidos} href="/atendimentos?status=atendido" icon={CheckCircle2} tone="secondary" />
        <StatCard label="Não atendidos" value={statusCounts.naoAtendidos} href="/atendimentos?status=nao_atendido" icon={XCircle} tone="danger" />
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
        <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todo status</option>
          {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</option>)}
        </select>
        <select name="tipo" defaultValue={params.tipo ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todo tipo</option>
          {ATTENDANCE_TYPES.map((t) => <option key={t} value={t}>{ATTENDANCE_TYPE_LABELS[t]}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          Filtrar
        </button>
      </form>

      {attendances.length === 0 ? (
        <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
          Nenhum atendimento encontrado.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:hidden">
            {attendances.map((a) => (
              <Link key={a.id} href={`/atendimentos/${a.id}`} className="block rounded-lg border border-black/5 bg-white p-4 hover:border-primary/30">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{a.supporters?.name ?? "—"}</p>
                  <Badge tone={STATUS_TONE[a.status as AttendanceStatus]}>
                    {ATTENDANCE_STATUS_LABELS[a.status as AttendanceStatus]}
                  </Badge>
                </div>
                <p className="text-xs text-foreground/50">{a.title}</p>
                <p className="mt-1 text-sm text-foreground/60">
                  {ATTENDANCE_TYPE_LABELS[a.attendance_type as AttendanceType]} · {a.leaders?.name ?? "—"}
                </p>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
                <tr>
                  <th className="px-4 py-3">Pessoa</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Liderança</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendances.map((a) => (
                  <tr key={a.id} className="border-t border-black/5">
                    <td className="px-4 py-3">
                      <Link href={`/atendimentos/${a.id}`} className="font-medium text-foreground hover:text-primary">
                        {a.supporters?.name ?? "—"}
                      </Link>
                      <p className="text-xs text-foreground/50">{a.title}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{ATTENDANCE_TYPE_LABELS[a.attendance_type as AttendanceType]}</td>
                    <td className="px-4 py-3 text-foreground/70">{a.leaders?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[a.status as AttendanceStatus]}>
                        {ATTENDANCE_STATUS_LABELS[a.status as AttendanceStatus]}
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
