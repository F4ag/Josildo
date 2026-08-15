"use client"

import { useEffect, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { createClient } from "@/lib/supabase/client"
import { updatePassword, exchangeRecoveryCode, hasActiveSession } from "./actions"
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
 * de duas formas possíveis:
 *
 * 1) `#access_token=...&refresh_token=...` (flow implicit — é o que este
 *    projeto usa hoje: todo disparo de resetPasswordForEmail passa por
 *    createResetEmailClient(), ver lib/supabase/reset-email-client.ts) — o
 *    fragmento nunca é enviado ao servidor, então precisa ser lido aqui no
 *    navegador e virar sessão via setSession no client SDK. Não depende de
 *    nada salvo previamente, então funciona em qualquer navegador/aparelho
 *    que abrir o link — inclusive um diferente do que pediu o link.
 * 2) `?code=xxxxx` (flow PKCE) — mantido só como fallback defensivo, caso
 *    algum link antigo (enviado antes desta correção) ainda esteja numa
 *    caixa de entrada. Não gerar mais links assim de propósito: PKCE precisa
 *    de um "code_verifier" salvo no MESMO navegador que vai abrir o link, e
 *    aqui quem dispara o e-mail quase nunca é o mesmo navegador de quem
 *    recebe (admin convidando liderança, "esqueci senha" às vezes aberto no
 *    e-mail do celular) — a troca falha sempre que os navegadores são
 *    diferentes. Foi exatamente isso que causava "Não foi possível redefinir
 *    a senha" mesmo em link recém-aberto (confirmado nos logs de auth do
 *    Supabase: o /verify do link aparecia, mas nunca um /token depois — a
 *    troca falhava localmente, sem chegar a chamar a rede).
 *
 * Sem este resgate (qualquer um dos dois casos), a página carrega sem sessão
 * nenhuma e a troca de senha falha silenciosamente com "peça um novo link".
 *
 * ANTES de tentar qualquer um dos dois, sempre checa primeiro se já existe
 * sessão ativa (hasActiveSession) — ver comentário completo em actions.ts.
 * Resumo: o cookie é do navegador inteiro, não da aba; se o link já foi
 * aberto com sucesso em outra aba (ou antes, na mesma aba), tentar trocar de
 * novo um código já usado podia sobrescrever e derrubar essa sessão boa.
 * Checando antes, uma aba "atrasada" simplesmente aproveita a sessão que já
 * existe, em vez de tentar (e falhar, com efeito colateral) trocar de novo.
 */
type SessionBridgeStatus = "loading" | "ready" | "invalid"

function useSessionBridge(): SessionBridgeStatus {
  const [status, setStatus] = useState<SessionBridgeStatus>("loading")

  useEffect(() => {
    async function run() {
      if (await hasActiveSession()) {
        setStatus("ready")
        return
      }

      const code = new URLSearchParams(window.location.search).get("code")

      if (code) {
        const { error } = await exchangeRecoveryCode(code)
        // Limpa o "code" da URL pra não deixar o token visível/reaproveitável.
        window.history.replaceState(null, "", window.location.pathname)
        // O retorno de exchangeRecoveryCode era ignorado antes — mesmo uma
        // troca que falhasse (link expirado, já usado, code_verifier
        // ausente) deixava a página seguir pro formulário como se nada
        // tivesse acontecido, e o erro só aparecia depois, ao salvar a
        // senha, sem nenhuma pista do motivo real.
        setStatus(error ? "invalid" : "ready")
        return
      }

      const hash = window.location.hash
      if (!hash || !hash.includes("access_token")) {
        setStatus("invalid")
        return
      }

      const params = new URLSearchParams(hash.slice(1))
      const access_token = params.get("access_token")
      const refresh_token = params.get("refresh_token")

      if (!access_token || !refresh_token) {
        setStatus("invalid")
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
      setStatus(error ? "invalid" : "ready")
    }

    run()
  }, [])

  return status
}

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePassword, initialState)
  const sessionStatus = useSessionBridge()

  // Navegação de página inteira (não redirect() no server nem router.push)
  // de propósito: o middleware pode precisar trocar de subdomínio pra
  // resolver o tenant da organização, e isso só funciona numa navegação real
  // do navegador — mesmo motivo documentado em login/login-form.tsx.
  useEffect(() => {
    if (state.success && state.redirectTo) {
      window.location.href = state.redirectTo
    }
  }, [state])

  if (sessionStatus === "loading") {
    return <p className="text-center text-sm text-foreground/60">Verificando link...</p>
  }

  // Detectado ANTES de mostrar o formulário: sem isso, a pessoa preenchia a
  // senha duas vezes pra só então descobrir, ao clicar em salvar, que o link
  // nunca teve (ou já perdeu) uma sessão válida.
  if (sessionStatus === "invalid") {
    return (
      <p role="alert" className="text-center text-sm text-status-atrasada">
        Este link não é válido ou já foi usado. Peça um novo link de recuperação.
      </p>
    )
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
