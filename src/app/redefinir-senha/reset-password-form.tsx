"use client"

import { useEffect, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { createClient } from "@/lib/supabase/client"
import { updatePassword } from "./actions"
import type { ActionState } from "../login/actions"

const initialState: ActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Salvando..." : "Definir nova senha"}
    </button>
  )
}

/**
 * Enquanto o template de e-mail "Reset Password"/"Invite user" no Supabase
 * ainda não foi customizado pra usar token_hash (isso exige SMTP próprio —
 * ver conversa sobre configurar o Resend), o link do e-mail usa o
 * {{ .ConfirmationURL }} padrão: o Supabase verifica o link no servidor
 * dele e devolve o navegador pra cá com a sessão embutida no FRAGMENTO da
 * URL (#access_token=...&refresh_token=...), não como query string.
 * Fragmento nunca é enviado ao servidor, então a rota de servidor
 * /auth/confirm não consegue ler isso — o resultado, sem este resgate, é
 * cair aqui sem sessão nenhuma e a troca de senha falhar silenciosamente.
 * Este hook lê o fragmento no navegador e cria a sessão via client SDK
 * (que grava em cookie, então o server action abaixo consegue lê-la).
 * Quando o template for customizado com token_hash, a verificação já
 * acontece 100% no servidor antes desta página carregar — o fragmento
 * nunca existe e este hook não encontra nada pra fazer.
 */
function useHashSessionBridge() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.includes("access_token")) {
      setReady(true)
      return
    }

    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get("access_token")
    const refresh_token = params.get("refresh_token")

    if (!access_token || !refresh_token) {
      setReady(true)
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token, refresh_token }).finally(() => {
      // Limpa o fragmento da URL pra não deixar o token visível/reaproveitável.
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
      setReady(true)
    })
  }, [])

  return ready
}

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePassword, initialState)
  const sessionReady = useHashSessionBridge()

  if (!sessionReady) {
    return <p className="text-center text-sm text-foreground/60">Verificando link...</p>
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-foreground">
          Confirmar nova senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
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
