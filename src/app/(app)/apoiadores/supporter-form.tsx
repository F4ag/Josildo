"use client"

import { useRef, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import { SUPPORTER_ORIGINS, SUPPORTER_ORIGIN_LABELS, type Supporter } from "@/types/domain"
import { fetchAddressByZipCode } from "@/lib/viacep"
import { PollingLocationAutocomplete } from "@/components/polling-location-autocomplete"
import type { SupporterActionState } from "./actions"

const initialState: SupporterActionState = { error: null }

function SubmitButton({ label = "Salvar" }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {pending ? "Salvando..." : label}
    </button>
  )
}

type SupporterFormProps = {
  action: (prevState: SupporterActionState, formData: FormData) => Promise<SupporterActionState>
  defaultValues?: Partial<Supporter>
  leaders?: { id: string; name: string }[]
  /** Liderança logada cadastrando na própria rede: some o seletor de liderança. */
  lockedToOwnNetwork?: boolean
  /** Mesma lógica de leader-form.tsx: rótulo já formatado do local de
   * votação vinculado, calculado pela página a partir do
   * polling_location_id (o registro de Supporter só guarda o id). */
  pollingLocationDefaultLabel?: string | null
  cancelHref: string
}

export function SupporterForm({
  action, defaultValues, leaders, lockedToOwnNetwork = false, pollingLocationDefaultLabel, cancelHref,
}: SupporterFormProps) {
  const [state, formAction] = useFormState(action, initialState)
  const [forceDuplicate, setForceDuplicate] = useState(false)
  const d = defaultValues

  // Mesmo padrão de liderancas/leader-form.tsx: refs pra permitir que o
  // autopreenchimento do CEP (onBlur) escreva nos campos sem depender de
  // controlar cada input via estado do React.
  const addressRef = useRef<HTMLInputElement>(null)
  const neighborhoodRef = useRef<HTMLInputElement>(null)
  const cityRef = useRef<HTMLInputElement>(null)
  const stateRef = useRef<HTMLInputElement>(null)

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
      {state.duplicates && state.duplicates.length > 0 && (
        <div className="rounded-md border border-accent/40 bg-accent/10 p-4 text-sm">
          <p className="font-medium text-accent-foreground">
            Encontramos {state.duplicates.length} possível(is) duplicidade(s):
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {state.duplicates.map((dup) => (
              <li key={dup.id}>
                {dup.name} — {dup.phone} {dup.neighborhood ? `(${dup.neighborhood})` : ""}
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox" name="force_duplicate" checked={forceDuplicate}
              onChange={(e) => setForceDuplicate(e.target.checked)} className="h-4 w-4"
            />
            Cadastrar mesmo assim (é uma pessoa diferente)
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="mb-1 block text-sm font-medium">Nome completo *</label>
          <input id="name" name="name" required defaultValue={d?.name}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">WhatsApp *</label>
          <input id="phone" name="phone" required placeholder="5511999999999" defaultValue={d?.phone}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="birth_date" className="mb-1 block text-sm font-medium">Data de nascimento *</label>
          <input id="birth_date" name="birth_date" type="date" required defaultValue={d?.birth_date}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="cpf" className="mb-1 block text-sm font-medium">CPF</label>
          <input id="cpf" name="cpf" placeholder="000.000.000-00" defaultValue={d?.cpf ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="mother_name" className="mb-1 block text-sm font-medium">Nome da mãe</label>
          <input id="mother_name" name="mother_name" defaultValue={d?.mother_name ?? undefined}
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
          <label htmlFor="address" className="mb-1 block text-sm font-medium">Endereço *</label>
          <input id="address" name="address" ref={addressRef} required defaultValue={d?.address}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="complement" className="mb-1 block text-sm font-medium">Complemento</label>
          <input id="complement" name="complement" placeholder="Casa, apartamento, bloco..." defaultValue={d?.complement ?? undefined}
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

        <PollingLocationAutocomplete
          name="polling_location_id"
          defaultId={d?.polling_location_id}
          defaultLabel={pollingLocationDefaultLabel}
        />

        <div>
          <label htmlFor="electoral_zone" className="mb-1 block text-sm font-medium">Zona eleitoral</label>
          <input id="electoral_zone" name="electoral_zone" placeholder="Ex.: 015" defaultValue={d?.electoral_zone ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="electoral_section" className="mb-1 block text-sm font-medium">Seção eleitoral</label>
          <input id="electoral_section" name="electoral_section" placeholder="Ex.: 0123" defaultValue={d?.electoral_section ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
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
          <label htmlFor="email" className="mb-1 block text-sm font-medium">E-mail</label>
          <input id="email" name="email" type="email" defaultValue={d?.email ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        {!lockedToOwnNetwork && leaders && (
          <div>
            <label htmlFor="leader_id" className="mb-1 block text-sm font-medium">Liderança vinculada</label>
            <select id="leader_id" name="leader_id" defaultValue={d?.leader_id ?? ""}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
              <option value="">Nenhuma</option>
              {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="origin" className="mb-1 block text-sm font-medium">Origem do cadastro</label>
          <select id="origin" name="origin" defaultValue={d?.origin ?? ""}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            <option value="">Selecione...</option>
            {SUPPORTER_ORIGINS.map((o) => <option key={o} value={o}>{SUPPORTER_ORIGIN_LABELS[o]}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="profession" className="mb-1 block text-sm font-medium">Profissão</label>
          <input id="profession" name="profession" defaultValue={d?.profession ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="notes" className="mb-1 block text-sm font-medium">Observações</label>
          <textarea id="notes" name="notes" rows={3} defaultValue={d?.notes ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
      </div>

      <div className="space-y-2 rounded-md bg-black/[0.02] p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consent_whatsapp" defaultChecked={d?.consent_whatsapp ?? false} className="h-4 w-4" />
          Autoriza contato por WhatsApp
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consent_email" defaultChecked={d?.consent_email ?? false} className="h-4 w-4" />
          Autoriza contato por e-mail
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent_registration" required
            defaultChecked={d?.consent_registration ?? false} className="mt-0.5 h-4 w-4" />
          <span>
            Autorizo o cadastro dos meus dados para fins de comunicação, atendimento de demandas e
            relacionamento institucional, conforme a legislação de proteção de dados. *
          </span>
        </label>
      </div>

      {state.error && <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={state.duplicates?.length ? "Confirmar cadastro" : "Salvar"} />
        <Link href={cancelHref} className="text-sm text-foreground/60 hover:underline">Cancelar</Link>
      </div>
    </form>
  )
}
