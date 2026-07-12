"use server"

import { createClient } from "@/lib/supabase/server"
import { loginSchema, forgotPasswordSchema } from "@/lib/validations/auth"

export type ActionState = { error: string | null; success?: boolean; redirectTo?: string }

export async function login(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // Mensagem genérica de propósito: não revelar se o e-mail existe ou não.
    return { error: "E-mail ou senha incorretos." }
  }

  // NÃO usar redirect() do next/navigation aqui: essa Server Action é chamada
  // via fetch() pelo runtime de Server Actions do React (useFormState), e o
  // navegador bloqueia por CORS um redirect que troca de domínio dentro de um
  // fetch (ex.: lideramais.app.br -> flux45.lideramais.app.br, feito pelo
  // middleware pra usuários de organização com subdomínio próprio). Por isso
  // devolvemos o destino e deixamos o componente cliente (login-form.tsx)
  // fazer uma navegação de página inteira (window.location.href), que segue
  // redirect entre domínios sem problema.
  const redirectTo = (formData.get("redirect") as string | null) || "/dashboard"
  return { error: null, success: true, redirectTo }
}

export async function requestPasswordReset(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    // Aponta direto pra /redefinir-senha (não mais pra /auth/confirm) —
    // com o template de e-mail padrão (ainda não customizado, ver conversa
    // sobre SMTP/Resend), o Supabase devolve a sessão embutida no fragmento
    // da URL (#access_token=...). Passando por /auth/confirm no meio, esse
    // fragmento se perdia no redirecionamento de servidor daquela rota
    // antes de chegar em reset-password-form.tsx, que é quem sabe lê-lo.
    // Indo direto num pulo só, o fragmento chega intacto.
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/redefinir-senha`,
  })

  // Não expor se o e-mail existe na base — sempre retorna sucesso genérico.
  if (error) {
    return { error: "Não foi possível processar o pedido agora. Tente de novo em instantes." }
  }

  return { error: null, success: true }
}
