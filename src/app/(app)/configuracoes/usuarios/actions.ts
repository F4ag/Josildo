"use server"

import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { inviteUserSchema } from "@/lib/validations/user"
import { setUserStatus } from "@/services/users"
import type { ActionState } from "@/app/login/actions"

async function assertAdminGeral() {
  const session = await requireSessionUser()
  if (session.profile.role !== "admin_geral") {
    throw new Error("Apenas o Admin Geral pode gerenciar usuários.")
  }
  return session
}

export async function inviteUser(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await assertAdminGeral()

  const parsed = inviteUserSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    role: formData.get("role"),
    leader_id: formData.get("leader_id") || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const { full_name, email, phone, role, leader_id } = parsed.data
  const admin = createAdminClient()

  // Cria o login e dispara o e-mail de convite. Aponta direto pra
  // /redefinir-senha (não mais via /auth/confirm) — ver comentário
  // equivalente em login/actions.ts sobre o fragmento da URL (#access_token=...)
  // se perdendo no salto extra de redirecionamento.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/redefinir-senha`,
  })

  if (inviteError || !invited.user) {
    return { error: `Não foi possível convidar este e-mail: ${inviteError?.message ?? "erro desconhecido"}.` }
  }

  // organization_id vem sempre do admin_geral que está convidando — o
  // convidado nunca pode entrar em outra organização (multi-tenant, ver
  // docs/07-migracao-multi-tenant.md). Não é um campo do formulário.
  const { error: profileError } = await admin.from("users_profiles").insert({
    id: invited.user.id,
    organization_id: session.profile.organization_id,
    full_name,
    email,
    phone: phone || null,
    role,
    leader_id: role === "lideranca" ? leader_id || null : null,
  })

  if (profileError) {
    // Não deixar um auth.users órfão sem perfil.
    await admin.auth.admin.deleteUser(invited.user.id)
    return { error: `Não foi possível salvar o perfil: ${profileError.message}.` }
  }

  if (role === "lideranca" && leader_id) {
    await admin.from("leaders").update({ user_id: invited.user.id }).eq("id", leader_id)
  }

  revalidatePath("/configuracoes/usuarios")
  return { error: null, success: true }
}

export async function toggleUserStatus(userId: string, currentStatus: "ativo" | "inativo") {
  await assertAdminGeral()
  const supabase = await createClient()
  const nextStatus = currentStatus === "ativo" ? "inativo" : "ativo"
  await setUserStatus(supabase, userId, nextStatus)
  revalidatePath("/configuracoes/usuarios")
}
