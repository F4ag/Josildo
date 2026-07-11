"use client"

import { useEffect, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { createClient } from "@/lib/supabase/client"
import { updatePassword, exchangeRecoveryCode } from "./actions"
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
 * O link de recuperação/convite do Supabase chega em /redefinir-senha de uma
 * de duas formas possíveis, dependendo do template de e-mail em uso:
 *
 * 1) `?code=xxxxx` (flow PKCE — é o que este projeto usa hoje com o template
 *    padrão do Supabase) — um código de uso único que precisa ser trocado por
 *    uma sessão de verdade via exchangeRecoveryCode, uma Server Action (só
 *    ela consegue gravar o cookie de sessão; Server Components não podem).
 * 2) `#access_token=...&refresh_token=...` (flow baseado em fragmento de
 *    URL) — o fragmento nunca é enviado ao servidor, então precisa ser lido
 *    aqui no navegador e virar sessão via setSession no client SDK.
 *
 * Sem este resgate (qualquer um dos dois casos), a página carrega sem sessão
 * nenhuma e a troca de senha falha silenciosamente com "peça um novo link".
 */
function useSessionBridge() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function run() {
      const code = new URLSearchParams(window.location.search).get("code")

      if (code) {
        await exchangeRecoveryCode(code)
        // Limpa o "code" da URL pra não deixar o token visível/reaproveitável.
        window.history.replaceState(null, "", window.location.pathname)
        setReady(true)
        return
      }

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
      await supabase.auth.setSession({ access_token, refresh_token })
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
      setReady(true)
    }

    run()
  }, [])

  return ready
}

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePassword, initialState)
  const sessionReady = useSessionBridge()

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
