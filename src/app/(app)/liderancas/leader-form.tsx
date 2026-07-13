"use client"

import { useRef } from "react"
import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import {
  LEADER_TYPES, LEADER_TYPE_LABELS, INFLUENCE_LEVELS, INFLUENCE_LEVEL_LABELS,
  LEADER_STATUSES, LEADER_STATUS_LABELS, type Leader,
} from "@/types/domain"
import { fetchAddressByZipCode } from "@/lib/viacep"
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
  /** Liderança cadastrando uma NOVA liderança (sua "filha" na hierarquia):
   * mesma restrição visual de isOwnRecord — quem decide influência/status/
   * permissão de ver atendimentos é sempre Admin Geral/Equipe, nunca quem
   * recrutou. A Server Action zera esses campos de qualquer forma (ver
   * liderancas/actions.ts), isto aqui é só pra não mostrar campo que a
   * escrita vai ignorar. */
  hideAdminFields?: boolean
  cancelHref: string
}

export function LeaderForm({
  action, defaultValues, isOwnRecord = false, hideAdminFields = false, cancelHref,
}: LeaderFormProps) {
  const [state, formAction] = useFormState(action, initialState)
  const d = defaultValues

  // Preenchidos à mão OU pelo autopreenchimento de CEP abaixo — por isso
  // são refs (inputs não controlados) em vez de estado do React: mais
  // simples de combinar com defaultValue/Server Actions sem duplicar a
  // fonte da verdade do valor de cada campo.
  const addressRef = useRef<HTMLInputElement>(null)
  const neighborhoodRef = useRef<HTMLInputElement>(null)
  const cityRef = useRef<HTMLInputElement>(null)
  const stateRef = useRef<HTMLInputElement>(null)

  // Dispara ao sair do campo CEP (não a cada tecla, pra não martelar o
  // ViaCEP): busca o endereço nos Correios e preenche rua/bairro/cidade/UF
  // se a busca achar algo. Se a pessoa já tinha digitado esses campos à
  // mão, o autopreenchimento sobrescreve — é o comportamento padrão em
  // formulários com CEP, e dá pra corrigir à mão depois se estiver errado.
  async function handleZipCodeBlur(event: React.FocusEvent<HTMLInputElement>) {
    const found = await fetchAddressByZipCode(event.target.value)
    if (!found) return
    if (addressRef.current) addressRef.current.value = found.logradouro
    if (neighborhoodRef.current) neighborhoodRef.current.value = found.bairro
    if (cityRef.current) cityRef.current.value = found.localidade
    if (stateRef.current) stateRef.current.value = found.uf
  }

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

        <div>
          <label htmlFor="zip_code" className="mb-1 block text-sm font-medium">CEP</label>
          <input id="zip_code" name="zip_code" placeholder="53000-000" defaultValue={d?.zip_code ?? undefined}
            onBlur={handleZipCodeBlur}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          <p className="mt-1 text-xs text-foreground/50">
            Preenche o endereço abaixo automaticamente e ajuda a localizar no mapa.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address" className="mb-1 block text-sm font-medium">Endereço</label>
          <input id="address" name="address" ref={addressRef} defaultValue={d?.address ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="neighborhood" className="mb-1 block text-sm font-medium">Bairro</label>
          <input id="neighborhood" name="neighborhood" ref={neighborhoodRef} defaultValue={d?.neighborhood ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="city" className="mb-1 block text-sm font-medium">Cidade</label>
          <input id="city" name="city" ref={cityRef} defaultValue={d?.city ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="state" className="mb-1 block text-sm font-medium">Estado (UF)</label>
          <input id="state" name="state" ref={stateRef} maxLength={2} placeholder="PE" defaultValue={d?.state ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm uppercase focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="latitude" className="mb-1 block text-sm font-medium">Latitude</label>
          <input id="latitude" name="latitude" inputMode="decimal" placeholder="-23.5505"
            defaultValue={d?.latitude ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          <p className="mt-1 text-xs text-foreground/50">
            Opcional — se deixar em branco, tentamos localizar automaticamente pelo endereço/CEP.
          </p>
        </div>

        <div>
          <label htmlFor="longitude" className="mb-1 block text-sm font-medium">Longitude</label>
          <input id="longitude" name="longitude" inputMode="decimal" placeholder="-46.6333"
            defaultValue={d?.longitude ?? undefined}
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

        {!isOwnRecord && !hideAdminFields && (
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
