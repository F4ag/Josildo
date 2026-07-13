"use client"

import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import type { UpdateClientActionState } from "../../actions"

const initialState: UpdateClientActionState = { error: null }

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lideramais.app.br"

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ativa", label: "Ativa" },
  { value: "suspensa", label: "Suspensa" },
  { value: "cancelada", label: "Cancelada" },
]

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

type ClientEditFormProps = {
  action: (prevState: UpdateClientActionState, formData: FormData) => Promise<UpdateClientActionState>
  defaultValues: { name: string; slug: string; status: string }
}

export function ClientEditForm({ action, defaultValues }: ClientEditFormProps) {
  const [state, formAction] = useFormState(action, initialState)

  if (state.success) {
    return (
      <div className="max-w-lg rounded-lg border border-black/5 bg-white p-6">
        <p className="text-sm text-foreground/80">Cliente atualizado.</p>
        <Link href="/clientes" className="mt-4 inline-block text-sm text-secondary hover:underline">
          Voltar para a lista de clientes
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg border border-black/5 bg-white p-6">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">Nome do cliente</label>
        <input
          id="name" name="name" required defaultValue={defaultValues.name}
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="slug" className="mb-1 block text-sm font-medium">Subdomínio</label>
        <div className="flex items-center gap-1">
          <input
            id="slug" name="slug" required defaultValue={defaultValues.slug}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <span className="whitespace-nowrap text-sm text-foreground/50">.{ROOT_DOMAIN}</span>
        </div>
        <p className="mt-1 text-xs text-foreground/50">
          Atenção: mudar o subdomínio muda o endereço que esse cliente usa pra entrar no sistema —
          qualquer favorito, PWA instalado ou link salvo com o endereço antigo para de funcionar.
        </p>
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium">Status</label>
        <select
          id="status" name="status" defaultValue={defaultValues.status}
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <Link href="/clientes" className="text-sm text-foreground/60 hover:underline">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
