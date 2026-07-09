"use client"

import { useFormState, useFormStatus } from "react-dom"
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS, type AttendanceStatus } from "@/types/domain"
import { updateAttendanceStatusAction } from "./actions"
import type { ActionState } from "@/app/login/actions"

const initialState: ActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {pending ? "Atualizando..." : "Atualizar status"}
    </button>
  )
}

export function StatusUpdateForm({ attendanceId, currentStatus }: { attendanceId: string; currentStatus: AttendanceStatus }) {
  const boundAction = updateAttendanceStatusAction.bind(null, attendanceId)
  const [state, formAction] = useFormState(boundAction, initialState)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-black/5 bg-white p-4">
      <p className="text-sm font-medium text-foreground">Atualizar status</p>

      <select name="status" defaultValue={currentStatus}
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
        {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</option>)}
      </select>

      <textarea name="result_description" placeholder="Resultado do atendimento (opcional)" rows={2}
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="return_sent" className="h-4 w-4" />
        Retorno já enviado à pessoa
      </label>

      <select name="return_channel" defaultValue=""
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
        <option value="">Canal do retorno (opcional)</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="email">E-mail</option>
        <option value="ligacao">Ligação</option>
        <option value="presencial">Presencial</option>
        <option value="outro">Outro</option>
      </select>

      {state.error && <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>}
      {state.success && <p className="text-sm text-secondary">Status atualizado.</p>}

      <SubmitButton />
    </form>
  )
}
