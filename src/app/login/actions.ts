"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loginSchema, forgotPasswordSchema } from "@/lib/validations/auth"

export type ActionState = { error: string | null; success?: boolean }

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

  const redirectTo = (formData.get("redirect") as string | null) || "/dashboard"
  redirect(redirectTo)
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
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/confirm?next=/redefinir-senha`,
  })

  // Não expor se o e-mail existe na base — sempre retorna sucesso genérico.
  if (error) {
    return { error: "Não foi possível processar o pedido agora. Tente de novo em instantes." }
  }

  return { error: null, success: true }
}
