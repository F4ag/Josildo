"use server"

import { createClient } from "@/lib/supabase/server"
import { resetPasswordSchema } from "@/lib/validations/auth"
import type { ActionState } from "../login/actions"

/**
 * O link de recuperação/convite do Supabase (flow PKCE, padrão do projeto)
 * chega em /redefinir-senha como `?code=xxxxx` — um código de uso único que
 * precisa ser trocado por uma sessão de verdade. Isso só pode ser feito
 * aqui, numa Server Action (ou Route Handler): Server Components não têm
 * permissão do Next.js para gravar cookies, então se essa troca acontecesse
 * lá a sessão nunca seria persistida e o formulário de troca de senha
 * continuaria falhando mesmo com o "code" certo na URL.
 */
export async function exchangeRecoveryCode(code: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
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
