"use client"

import { useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import { createClientAction, type CreateClientActionState } from "../actions"

const initialState: CreateClientActionState = { error: null }

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lideramais.app.br"

/** "Fulano de Tal" -> "fulano-de-tal" — só uma sugestão inicial pro campo
 * slug; a pessoa pode editar livremente antes de enviar. Mesma regex do
 * CHECK constraint do banco (ver lib/validations/organization.ts). */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (marcas de combinacao, apos NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Criando..." : "Criar cliente"}
    </button>
  )
}

export function ClientForm() {
  const [state, formAction] = useFormState(createClientAction, initialState)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  if (state.success) {
    return (
      <div className="max-w-lg rounded-lg border border-black/5 bg-white p-6">
        <p className="text-sm text-foreground/80">
          Cliente criado. O responsável vai receber um e-mail para definir a senha. Assim que
          entrar, o acesso já vai estar isolado em{" "}
          <strong>{state.slug}.{ROOT_DOMAIN}</strong>.
        </p>
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
          id="name" name="name" required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="slug" className="mb-1 block text-sm font-medium">Subdomínio</label>
        <div className="flex items-center gap-1">
          <input
            id="slug" name="slug" required
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true) }}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <span className="whitespace-nowrap text-sm text-foreground/50">.{ROOT_DOMAIN}</span>
        </div>
        <p className="mt-1 text-xs text-foreground/50">
          Só letras minúsculas, números e hífen. É o endereço que esse cliente vai usar pra acessar
          o sistema.
        </p>
      </div>

      <div className="border-t border-black/5 pt-4">
        <p className="mb-3 text-sm font-medium text-foreground">Responsável (Admin Geral)</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="admin_full_name" className="mb-1 block text-sm font-medium">Nome completo</label>
            <input
              id="admin_full_name" name="admin_full_name" required
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="admin_email" className="mb-1 block text-sm font-medium">E-mail</label>
            <input
              id="admin_email" name="admin_email" type="email" required
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-foreground/50">
              Precisa ser um e-mail que ainda não tem login em nenhum cliente desta plataforma.
            </p>
          </div>
        </div>
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
