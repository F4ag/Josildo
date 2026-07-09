"use client"

import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import { DEMAND_TYPES, DEMAND_TYPE_LABELS, PRIORITIES, PRIORITY_LABELS } from "@/types/domain"
import { createDemandAction } from "./actions"
import type { ActionState } from "@/app/login/actions"

const initialState: ActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {pending ? "Salvando..." : "Registrar demanda"}
    </button>
  )
}

type DemandFormProps = {
  leaders?: { id: string; name: string }[]
  supporters?: { id: string; name: string }[]
  lockedToOwnNetwork?: boolean
}

export function DemandForm({ leaders, supporters, lockedToOwnNetwork = false }: DemandFormProps) {
  const [state, formAction] = useFormState(createDemandAction, initialState)

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
          <label htmlFor="demand_type" className="mb-1 block text-sm font-medium">Tipo</label>
          <select id="demand_type" name="demand_type"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            <option value="">Selecione...</option>
            {DEMAND_TYPES.map((t) => <option key={t} value={t}>{DEMAND_TYPE_LABELS[t]}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="mb-1 block text-sm font-medium">Prioridade</label>
          <select id="priority" name="priority" defaultValue="media"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>

        {!lockedToOwnNetwork && leaders && (
          <div>
            <label htmlFor="leader_id" className="mb-1 block text-sm font-medium">Liderança solicitante</label>
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
              <option value="">Nenhuma (demanda coletiva/territorial)</option>
              {supporters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="neighborhood" className="mb-1 block text-sm font-medium">Bairro</label>
          <input id="neighborhood" name="neighborhood"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address" className="mb-1 block text-sm font-medium">Endereço da demanda</label>
          <input id="address" name="address"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="due_date" className="mb-1 block text-sm font-medium">Prazo</label>
          <input id="due_date" name="due_date" type="date"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="public_agency" className="mb-1 block text-sm font-medium">Órgão responsável</label>
          <input id="public_agency" name="public_agency"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <Link href="/demandas" className="text-sm text-foreground/60 hover:underline">Cancelar</Link>
      </div>
    </form>
  )
}
