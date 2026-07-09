"use client"

import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import { ATTENDANCE_TYPES, ATTENDANCE_TYPE_LABELS, PRIORITIES, PRIORITY_LABELS } from "@/types/domain"
import { createAttendanceAction } from "./actions"
import type { ActionState } from "@/app/login/actions"

const initialState: ActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {pending ? "Salvando..." : "Registrar atendimento"}
    </button>
  )
}

export function AttendanceForm({
  supporters, leaders,
}: {
  supporters: { id: string; name: string }[]
  leaders: { id: string; name: string }[]
}) {
  const [state, formAction] = useFormState(createAttendanceAction, initialState)

  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-lg border border-black/5 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="supporter_id" className="mb-1 block text-sm font-medium">Pessoa atendida *</label>
          <select id="supporter_id" name="supporter_id" required
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            <option value="">Selecione...</option>
            {supporters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {supporters.length === 0 && (
            <p className="mt-1 text-xs text-foreground/50">
              Nenhum apoiador cadastrado ainda. Cadastre em /apoiadores primeiro.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="leader_id" className="mb-1 block text-sm font-medium">Liderança vinculada</label>
          <select id="leader_id" name="leader_id"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            <option value="">Nenhuma</option>
            {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="attendance_type" className="mb-1 block text-sm font-medium">Tipo de atendimento *</label>
          <select id="attendance_type" name="attendance_type" required
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            <option value="">Selecione...</option>
            {ATTENDANCE_TYPES.map((t) => <option key={t} value={t}>{ATTENDANCE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="mb-1 block text-sm font-medium">Prioridade</label>
          <select id="priority" name="priority" defaultValue="media"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>

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
          <label htmlFor="due_date" className="mb-1 block text-sm font-medium">Prazo</label>
          <input id="due_date" name="due_date" type="date"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <Link href="/atendimentos" className="text-sm text-foreground/60 hover:underline">Cancelar</Link>
      </div>
    </form>
  )
}
