"use client"

import { useFormState, useFormStatus } from "react-dom"
import { AGENDA_STATUSES, AGENDA_STATUS_LABELS, type AgendaStatus } from "@/types/domain"
import { updateAgendaEventStatusAction } from "./actions"
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

export function StatusUpdateForm({ eventId, currentStatus }: { eventId: string; currentStatus: AgendaStatus }) {
  const boundAction = updateAgendaEventStatusAction.bind(null, eventId)
  const [state, formAction] = useFormState(boundAction, initialState)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-black/5 bg-white p-4">
      <p className="text-sm font-medium text-foreground">Atualizar status</p>

      <select name="status" defaultValue={currentStatus}
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
        {AGENDA_STATUSES.map((s) => <option key={s} value={s}>{AGENDA_STATUS_LABELS[s]}</option>)}
      </select>

      {state.error && <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>}
      {state.success && <p className="text-sm text-secondary">Status atualizado.</p>}

      <SubmitButton />
    </form>
  )
}
