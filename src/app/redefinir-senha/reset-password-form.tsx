"use client"

import { useEffect, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { createClient } from "@/lib/supabase/client"
import { updatePassword, exchangeRecoveryCode, hasActiveSession, verifyInviteToken } from "./actions"
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
 * de três formas possíveis:
 *
 * 1) `#access_token=...&refresh_token=...` (flow implicit — é o que este
 *    projeto usa hoje pro canal e-mail: todo disparo de resetPasswordForEmail
 *    passa por createResetEmailClient(), ver lib/supabase/reset-email-client.ts)
 *    — o fragmento nunca é enviado ao servidor, então precisa ser lido aqui
 *    no navegador e virar sessão via setSession no client SDK. Não depende
 *    de nada salvo previamente, então funciona em qualquer navegador/
 *    aparelho que abrir o link — inclusive um diferente do que pediu o link.
 * 2) `?token_hash=...&type=invite|recovery` (canal WhatsApp, gerado por
 *    admin.generateLink em liderancas/actions.ts) — DE PROPÓSITO não é
 *    trocado automaticamente aqui: fica pendente até a pessoa confirmar com
 *    um clique (ver ConfirmInviteButton mais abaixo). O link do
 *    generateLink aponta pro /verify do Supabase, um GET de uso único; o
 *    próprio WhatsApp busca a URL sozinho pra montar a prévia da mensagem
 *    assim que ela é enviada, e esse GET automático consome o token antes da
 *    pessoa sequer ver a mensagem. Confirmado nos logs de auth do Supabase:
 *    um /verify bem-sucedido, e ~19s depois outro pro mesmo link com
 *    "One-time token not found" (o toque de verdade, já tarde demais). Por
 *    isso o link agora carrega só o token_hash (não o link direto do
 *    Supabase), e a troca de verdade (verifyInviteToken) só roda a partir de
 *    um POST de clique real — bots de prévia de link nunca enviam
 *    formulário, só fazem GET.
 * 3) `?code=xxxxx` (flow PKCE) — mantido só como fallback defensivo, caso
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
 * Sem este resgate, a página carrega sem sessão nenhuma e a troca de senha
 * falha silenciosamente com "peça um novo link".
 *
 * ANTES de tentar qualquer um dos casos, sempre checa primeiro se já existe
 * sessão ativa (hasActiveSession) — ver comentário completo em actions.ts.
 * Resumo: o cookie é do navegador inteiro, não da aba; se o link já foi
 * aberto com sucesso em outra aba (ou antes, na mesma aba), tentar trocar de
 * novo um código já usado podia sobrescrever e derrubar essa sessão boa.
 * Checando antes, uma aba "atrasada" simplesmente aproveita a sessão que já
 * existe, em vez de tentar (e falhar, com efeito colateral) trocar de novo.
 */
type SessionBridgeStatus =
  | "loading"
  | "ready"
  | "invalid"
  | { pendingConfirm: { tokenHash: string; type: "invite" | "recovery" } }

function useSessionBridge(): SessionBridgeStatus {
  const [status, setStatus] = useState<SessionBridgeStatus>("loading")

  useEffect(() => {
    async function run() {
      if (await hasActiveSession()) {
        setStatus("ready")
        return
      }

      const search = new URLSearchParams(window.location.search)
      const code = search.get("code")

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

      const tokenHash = search.get("token_hash")
      const type = search.get("type")
      if (tokenHash && (type === "invite" || type === "recovery")) {
        // Não troca aqui — só fica pendente até a pessoa confirmar com um
        // clique. Ver comentário completo acima (item 2).
        setStatus({ pendingConfirm: { tokenHash, type } })
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

function ConfirmInviteButton({ tokenHash, type }: { tokenHash: string; type: "invite" | "recovery" }) {
  const [pending, setPending] = useState(false)

  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-foreground/70">Você foi convidado(a) para o Lidera+.</p>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          await verifyInviteToken(tokenHash, type)
          // Recarrega a página inteira, já sem token_hash/type na URL (em vez
          // de só trocar o estado local), pra que useSessionBridge rode de
          // novo do zero: com sucesso, hasActiveSession acha a sessão recém-
          // criada (ready); sem sucesso (link já usado/expirado), nenhum
          // parâmetro reconhecido sobra na URL, e cai direto em "invalid" —
          // o mesmo caminho que qualquer outra visita normal usa, sem
          // duplicar lógica de mensagem de erro aqui.
          window.location.href = window.location.pathname
        }}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Confirmando..." : "Confirmar convite"}
      </button>
    </div>
  )
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

  if (typeof sessionStatus === "object") {
    const { tokenHash, type } = sessionStatus.pendingConfirm
    return <ConfirmInviteButton tokenHash={tokenHash} type={type} />
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
