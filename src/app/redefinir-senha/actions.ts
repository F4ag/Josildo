"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { resetPasswordSchema } from "@/lib/validations/auth"
import type { ActionState } from "../login/actions"

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

  // Só funciona se houver uma sessão de recuperação ativa (criada pelo
  // /auth/confirm a partir do link do e-mail). Sem isso, updateUser falha.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return { error: "Não foi possível redefinir a senha. Peça um novo link de recuperação." }
  }

  redirect("/login?senha_redefinida=1")
}
