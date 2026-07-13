import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getAttendanceById } from "@/services/attendances"
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_TYPE_LABELS, PRIORITY_LABELS, type AttendanceStatus, type AttendanceType, type Priority, type UserRole } from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { WhatsAppButton } from "@/components/whatsapp-button"
import { can } from "@/lib/permissions"
import { StatusUpdateForm } from "../status-update-form"

export const metadata: Metadata = { title: "Atendimento · Lidera+" }

export default async function AtendimentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [attendance, session] = await Promise.all([getAttendanceById(supabase, id), getSessionUser()])

  if (!attendance) notFound()

  const role = session?.profile.role as UserRole
  const canUpdateStatus = can(role, "update_status", "attendances")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold text-foreground">{attendance.title}</h1>
          <p className="text-sm text-foreground/60">{ATTENDANCE_TYPE_LABELS[attendance.attendance_type as AttendanceType]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="azul">{ATTENDANCE_STATUS_LABELS[attendance.status as AttendanceStatus]}</Badge>
          <Badge tone="cinza">{PRIORITY_LABELS[attendance.priority as Priority]}</Badge>
        </div>
      </div>

      <div className="grid gap-6 rounded-lg border border-black/5 bg-white p-6 sm:grid-cols-2">
        {attendance.description && (
          <div className="sm:col-span-2">
            <Info label="Descrição" value={attendance.description} />
          </div>
        )}
        <div>
          <p className="text-xs uppercase text-foreground/50">Pessoa atendida</p>
          <Link href={`/apoiadores/${attendance.supporters?.id}`} className="text-sm text-secondary hover:underline">
            {attendance.supporters?.name}
          </Link>
        </div>
        <div>
          <p className="text-xs uppercase text-foreground/50">Liderança vinculada</p>
          {attendance.leaders ? (
            <Link href={`/liderancas/${attendance.leaders.id}`} className="text-sm text-secondary hover:underline">
              {attendance.leaders.name}
            </Link>
          ) : (
            <p className="text-sm text-foreground">—</p>
          )}
        </div>
        <Info label="Prazo" value={attendance.due_date} />
        <Info label="Retorno enviado?" value={attendance.return_sent ? "Sim" : "Não"} />
        {attendance.result_description && (
          <div className="sm:col-span-2">
            <Info label="Resultado" value={attendance.result_description} />
          </div>
        )}
      </div>

      <WhatsAppButton
        phone={attendance.supporters?.phone ?? null}
        message={`Olá, ${attendance.supporters?.name}! Passando para falar sobre "${attendance.title}".`}
        consentWhatsapp={attendance.supporters?.consent_whatsapp}
      />

      {canUpdateStatus && <StatusUpdateForm attendanceId={id} currentStatus={attendance.status as AttendanceStatus} />}
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
