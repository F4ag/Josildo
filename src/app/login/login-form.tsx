"use client"

import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { login, type ActionState } from "./actions"

const initialState: ActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  )
}

export function LoginForm() {
  const [state, formAction] = useFormState(login, initialState)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect")
  const contaInativa = searchParams.get("erro") === "conta_inativa"

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}

      {contaInativa && (
        <p className="rounded-md bg-status-atrasada/10 px-3 py-2 text-sm text-status-atrasada">
          Sua conta está inativa. Fale com o Admin Geral da sua campanha.
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Senha
          </label>
          <Link href="/esqueci-senha" className="text-xs text-secondary hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-status-atrasada">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}
