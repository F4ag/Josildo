"use client"

import { useFormState, useFormStatus } from "react-dom"
import { updateElectionSettings } from "./actions"
import { ELECTION_CARGOS, ELECTION_CARGO_LABELS } from "@/lib/validations/election"
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

type CurrentValues = { election_year: number | null; election_cargo: string | null; election_candidate_number: string | null }

export function ElectionForm({ current }: { current: CurrentValues }) {
  const [state, formAction] = useFormState(updateElectionSettings, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-4 rounded-lg border border-black/5 bg-white p-6">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Configuração salva.</p>
      )}

      <div>
        <label htmlFor="election_cargo" className="block text-sm font-medium text-foreground">Cargo</label>
        <select
          id="election_cargo"
          name="election_cargo"
          defaultValue={current.election_cargo ?? ""}
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm"
        >
          <option value="" disabled>Selecione o cargo</option>
          {ELECTION_CARGOS.map((c) => (
            <option key={c} value={c}>{ELECTION_CARGO_LABELS[c]}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="election_candidate_number" className="block text-sm font-medium text-foreground">
          Número do candidato
        </label>
        <input
          id="election_candidate_number"
          name="election_candidate_number"
          type="text"
          inputMode="numeric"
          defaultValue={current.election_candidate_number ?? ""}
          placeholder="Ex.: 12345"
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-foreground/50">O mesmo número que aparece na urna, sem pontos ou espaços.</p>
      </div>

      <div>
        <label htmlFor="election_year" className="block text-sm font-medium text-foreground">Ano da eleição</label>
        <input
          id="election_year"
          name="election_year"
          type="number"
          defaultValue={current.election_year ?? ""}
          placeholder="Ex.: 2026"
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm"
        />
      </div>

      <p className="text-xs text-foreground/50">
        Usado para importar automaticamente o resultado real da votação, seção por seção, direto do TSE, e comparar
        com a expectativa cadastrada no relatório &quot;Comparativo de votos&quot;. Só fica disponível depois da
        apuração.
      </p>

      <SubmitButton />
    </form>
  )
}
