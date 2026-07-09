"use client"

import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import { requestPasswordReset, type ActionState } from "../login/actions"

const initialState: ActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Enviando..." : "Enviar link de recuperação"}
    </button>
  )
}

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, initialState)

  if (state.success) {
    return (
      <p className="text-sm text-foreground/80">
        Se o e-mail informado estiver cadastrado, você vai receber um link para redefinir sua
        senha em instantes. Volte para o{" "}
        <Link href="/login" className="text-secondary hover:underline">
          login
        </Link>
        .
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
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

      {state.error && (
        <p role="alert" className="text-sm text-status-atrasada">
          {state.error}
        </p>
      )}

      <SubmitButton />

      <p className="text-center text-sm">
        <Link href="/login" className="text-secondary hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  )
}
