"use client"

import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import {
  LEADER_TYPES, LEADER_TYPE_LABELS, INFLUENCE_LEVELS, INFLUENCE_LEVEL_LABELS,
  LEADER_STATUSES, LEADER_STATUS_LABELS, type Leader,
} from "@/types/domain"
import type { ActionState } from "@/app/login/actions"

const initialState: ActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Salvando..." : "Salvar"}
    </button>
  )
}

type LeaderFormProps = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  defaultValues?: Partial<Leader>
  /** Liderança editando o próprio cadastro: esconde campos administrativos. */
  isOwnRecord?: boolean
  cancelHref: string
}

export function LeaderForm({ action, defaultValues, isOwnRecord = false, cancelHref }: LeaderFormProps) {
  const [state, formAction] = useFormState(action, initialState)
  const d = defaultValues

  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-lg border border-black/5 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="mb-1 block text-sm font-medium">Nome completo *</label>
          <input id="name" name="name" required defaultValue={d?.name}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="nickname" className="mb-1 block text-sm font-medium">Apelido / nome popular</label>
          <input id="nickname" name="nickname" defaultValue={d?.nickname ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">WhatsApp</label>
          <input id="phone" name="phone" placeholder="5511999999999" defaultValue={d?.phone ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">E-mail</label>
          <input id="email" name="email" type="email" defaultValue={d?.email ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="birth_date" className="mb-1 block text-sm font-medium">Data de nascimento</label>
          <input id="birth_date" name="birth_date" type="date" defaultValue={d?.birth_date ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address" className="mb-1 block text-sm font-medium">Endereço</label>
          <input id="address" name="address" defaultValue={d?.address ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="neighborhood" className="mb-1 block text-sm font-medium">Bairro</label>
          <input id="neighborhood" name="neighborhood" defaultValue={d?.neighborhood ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="city" className="mb-1 block text-sm font-medium">Cidade</label>
          <input id="city" name="city" defaultValue={d?.city ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="leader_type" className="mb-1 block text-sm font-medium">Tipo de liderança</label>
          <select id="leader_type" name="leader_type" defaultValue={d?.leader_type ?? ""}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            <option value="">Selecione...</option>
            {LEADER_TYPES.map((t) => <option key={t} value={t}>{LEADER_TYPE_LABELS[t]}</option>)}
          </select>
        </div>

        {!isOwnRecord && (
          <>
            <div>
              <label htmlFor="influence_level" className="mb-1 block text-sm font-medium">Nível de influência</label>
              <select id="influence_level" name="influence_level" defaultValue={d?.influence_level ?? ""}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
                <option value="">Selecione...</option>
                {INFLUENCE_LEVELS.map((l) => <option key={l} value={l}>{INFLUENCE_LEVEL_LABELS[l]}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="mb-1 block text-sm font-medium">Status</label>
              <select id="status" name="status" defaultValue={d?.status ?? "ativa"}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
                {LEADER_STATUSES.map((s) => <option key={s} value={s}>{LEADER_STATUS_LABELS[s]}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input id="can_view_attendances" name="can_view_attendances" type="checkbox"
                defaultChecked={d?.can_view_attendances ?? false} className="h-4 w-4" />
              <label htmlFor="can_view_attendances" className="text-sm">
                Pode ver atendimentos da própria rede
              </label>
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="notes" className="mb-1 block text-sm font-medium">Observações</label>
          <textarea id="notes" name="notes" rows={3} defaultValue={d?.notes ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <Link href={cancelHref} className="text-sm text-foreground/60 hover:underline">Cancelar</Link>
      </div>
    </form>
  )
}
