"use server"

import { createClient } from "@/lib/supabase/server"
import { resetPasswordSchema } from "@/lib/validations/auth"
import type { ActionState } from "../login/actions"

/**
 * Checa se já existe uma sessão válida ANTES de tentar trocar o código do
 * link — chamado sempre no início de useSessionBridge, em reset-password-
 * form.tsx.
 *
 * Por quê: o cookie de sessão é do NAVEGADOR, não da aba. Se a pessoa abre o
 * mesmo link de recuperação em mais de uma aba (ou clica nele de novo depois
 * de já ter funcionado numa aba anterior), a PRIMEIRA troca bem-sucedida já
 * deixa o navegador inteiro autenticado — inclusive as outras abas. O bug
 * real que isso corrige: sem essa checagem, uma aba "atrasada" chamava
 * exchangeRecoveryCode com um código JÁ USADO, e o próprio
 * exchangeCodeForSession (mesmo retornando erro) podia sobrescrever o
 * cookie de sessão bom que já existia — derrubando a sessão que a outra aba
 * tinha acabado de estabelecer. Agora, se já existe sessão, a troca nem é
 * tentada: nada é escrito por cima do que já está funcionando.
 */
export async function hasActiveSession(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return Boolean(data.user)
}

/**
 * Fallback defensivo para o flow PKCE (`?code=xxxxx`). Não é mais o formato
 * gerado de propósito — desde a correção em lib/supabase/reset-email-client.ts,
 * todo e-mail de definir/redefinir senha usa flow implicit (`#access_token=`,
 * ver reset-password-form.tsx). Mantido só para links antigos, já enviados
 * antes da correção, que ainda possam estar numa caixa de entrada.
 *
 * Por que PKCE quebrava sempre nesse projeto: resetPasswordForEmail (chamado
 * do lado do servidor, pelo client de sessão de quem dispara o convite/reset)
 * grava o code_verifier num cookie do NAVEGADOR DE QUEM CHAMOU a função — não
 * do navegador que vai abrir o e-mail depois, quase sempre um aparelho
 * diferente. Sem esse cookie, essa troca aqui sempre falha (localmente, sem
 * nem chegar a chamar a rede — ver AuthPKCECodeVerifierMissingError em
 * @supabase/auth-js). Isso só pode ser feito aqui, numa Server Action (ou
 * Route Handler): Server Components não têm permissão do Next.js para gravar
 * cookies, então se essa troca acontecesse lá a sessão nunca seria
 * persistida e o formulário de troca de senha continuaria falhando mesmo com
 * o "code" certo na URL.
 */
export async function exchangeRecoveryCode(code: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return { error: error.message }
  }
  return { error: null }
}

/**
 * Troca um `token_hash` (gerado por admin.generateLink, usado hoje só pro
 * canal WhatsApp — ver liderancas/actions.ts) por uma sessão de verdade.
 *
 * De propósito, SÓ é chamada a partir de um clique explícito da pessoa (ver
 * reset-password-form.tsx, tela de "Confirmar convite" antes do formulário)
 * — nunca automaticamente ao carregar a página. Motivo: o link do
 * admin.generateLink aponta pro /verify do Supabase, um GET de uso único.
 * Quando esse link é mandado por WhatsApp, o próprio WhatsApp busca a URL
 * sozinho pra montar a prévia da mensagem (link preview) — sem nenhuma ação
 * da pessoa — e esse GET automático já CONSOME o token. Confirmado nos logs
 * de auth do Supabase: um /verify bem-sucedido, e ~19 segundos depois outro
 * /verify pro mesmo link com "One-time token not found" (o clique de
 * verdade, já tarde demais). Por isso agora o token não vai mais direto no
 * link (que qualquer prévia automática consegue buscar): vai só o
 * `token_hash`, e a troca de verdade só acontece aqui, num Server Action
 * disparado por um POST de clique real — bots de prévia de link nunca
 * enviam formulário, só fazem GET.
 */
export async function verifyInviteToken(
  tokenHash: string,
  type: "invite" | "recovery",
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) {
    return { error: error.message }
  }
  return { error: null }
}

export async function updatePassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()

  // Só funciona se houver uma sessão de recuperação ativa (criada pela troca
  // do código PKCE em exchangeRecoveryCode, chamada antes deste form ser
  // exibido). Sem isso, updateUser falha.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    // "Peça um novo link" só faz sentido quando o problema É o link/sessão
    // (expirado, já usado, ausente). Usar essa mensagem pra QUALQUER erro
    // — como fazia antes — confunde quem digitou a mesma senha de novo ou
    // uma senha fraca: a pessoa acha que precisa de um link novo quando só
    // precisa escolher outra senha. error.code vem estruturado do
    // supabase-js (AuthApiError#code) desde a v2.45, que é a que este
    // projeto usa — ver package.json.
    if (error.code === "same_password") {
      return { error: "A nova senha precisa ser diferente da senha atual." }
    }
    if (error.code === "weak_password") {
      return { error: "Essa senha é fraca demais. Tente uma combinação mais forte." }
    }
    if (error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") {
      return { error: "Muitas tentativas em seguida. Aguarde um minuto e tente de novo." }
    }
    // session_not_found / auth_session_missing / token expirado ou já usado
    // caem aqui — é o único grupo pra que "peça um novo link" é o conselho
    // certo.
    return { error: "Não foi possível redefinir a senha. Peça um novo link de recuperação." }
  }

  // NÃO usar redirect() do next/navigation aqui: mesmo problema documentado
  // em login/actions.ts — essa Server Action é chamada via fetch() pelo
  // useFormState, e um redirect que troca de host (ex.: lideramais.app.br ->
  // flux45.lideramais.app.br, feito pelo middleware pra resolver o tenant da
  // organização) quebra dentro dessa cadeia de fetch/RSC, derrubando a
  // página com "Application error: a client-side exception has occurred".
  // Devolvemos o destino e deixamos o componente cliente
  // (reset-password-form.tsx) fazer uma navegação de página inteira
  // (window.location.href), que segue redirect entre domínios sem problema.
  return { error: null, success: true, redirectTo: "/login?senha_redefinida=1" }
}
