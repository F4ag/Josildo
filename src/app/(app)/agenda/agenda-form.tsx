"use client"

import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import { createAgendaEventAction } from "./actions"
import type { ActionState } from "@/app/login/actions"

const initialState: ActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {pending ? "Salvando..." : "Agendar compromisso"}
    </button>
  )
}

type AgendaFormProps = {
  leaders?: { id: string; name: string }[]
  supporters?: { id: string; name: string }[]
  lockedToOwnNetwork?: boolean
}

export function AgendaForm({ leaders, supporters, lockedToOwnNetwork = false }: AgendaFormProps) {
  const [state, formAction] = useFormState(createAgendaEventAction, initialState)

  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-lg border border-black/5 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className="mb-1 block text-sm font-medium">Título *</label>
          <input id="title" name="title" required
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className="mb-1 block text-sm font-medium">Descrição</label>
          <textarea id="description" name="description" rows={3}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="event_date" className="mb-1 block text-sm font-medium">Data *</label>
          <input id="event_date" name="event_date" type="date" required
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="event_time" className="mb-1 block text-sm font-medium">Horário</label>
          <input id="event_time" name="event_time" type="time"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="location" className="mb-1 block text-sm font-medium">Local</label>
          <input id="location" name="location"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="neighborhood" className="mb-1 block text-sm font-medium">Bairro</label>
          <input id="neighborhood" name="neighborhood"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        {!lockedToOwnNetwork && leaders && (
          <div>
            <label htmlFor="leader_id" className="mb-1 block text-sm font-medium">Liderança relacionada</label>
            <select id="leader_id" name="leader_id"
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
              <option value="">Nenhuma</option>
              {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        {supporters && (
          <div>
            <label htmlFor="supporter_id" className="mb-1 block text-sm font-medium">Pessoa relacionada</label>
            <select id="supporter_id" name="supporter_id"
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
              <option value="">Nenhuma</option>
              {supporters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="notes" className="mb-1 block text-sm font-medium">Observações</label>
          <textarea id="notes" name="notes" rows={2}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <Link href="/agenda" className="text-sm text-foreground/60 hover:underline">Cancelar</Link>
      </div>
    </form>
  )
}
