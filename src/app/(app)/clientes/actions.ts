"use server"

import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isSlugTaken, isEmailTaken, createOrganizationRow, getOrganizationById, updateOrganizationRow,
} from "@/services/organizations"
import { createOrganizationSchema, updateOrganizationSchema } from "@/lib/validations/organization"

export type CreateClientActionState = {
  error: string | null
  success?: boolean
  slug?: string
}

/** Só contas com is_platform_admin (Agência F4) — nunca um admin_geral de
 * cliente. Ver comentário na coluna, em supabase/schema.sql. */
async function assertPlatformAdmin() {
  const session = await requireSessionUser()
  if (!session.profile.is_platform_admin) {
    throw new Error("Apenas a Agência F4 pode gerenciar clientes da plataforma.")
  }
  return session
}

export async function createClientAction(
  _prevState: CreateClientActionState,
  formData: FormData,
): Promise<CreateClientActionState> {
  await assertPlatformAdmin()

  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    admin_full_name: formData.get("admin_full_name"),
    admin_email: formData.get("admin_email"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const { name, slug, admin_full_name, admin_email } = parsed.data
  const admin = createAdminClient()

  if (await isSlugTaken(admin, slug)) {
    return { error: `O subdomínio "${slug}" já está em uso por outro cliente.` }
  }
  if (await isEmailTaken(admin, admin_email)) {
    return { error: `O e-mail "${admin_email}" já pertence a uma conta existente (de qualquer cliente).` }
  }

  const org = await createOrganizationRow(admin, name, slug)

  // Convite do primeiro admin_geral do cliente novo — mesmo fluxo/redirectTo
  // de configuracoes/usuarios/actions.ts (inviteUser).
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(admin_email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/redefinir-senha`,
  })

  if (inviteError || !invited.user) {
    // Não deixar uma organização órfã sem admin.
    await admin.from("organizations").delete().eq("id", org.id)
    return { error: `Não foi possível convidar o responsável: ${inviteError?.message ?? "erro desconhecido"}.` }
  }

  const { error: profileError } = await admin.from("users_profiles").insert({
    id: invited.user.id,
    organization_id: org.id,
    full_name: admin_full_name,
    email: admin_email,
    role: "admin_geral",
    status: "ativo",
  })

  if (profileError) {
    // Não deixar auth.users nem organization órfãos.
    await admin.auth.admin.deleteUser(invited.user.id)
    await admin.from("organizations").delete().eq("id", org.id)
    return { error: `Não foi possível salvar o perfil do responsável: ${profileError.message}.` }
  }

  revalidatePath("/clientes")
  return { error: null, success: true, slug: org.slug }
}

export type UpdateClientActionState = { error: string | null; success?: boolean }

export async function updateClientAction(
  organizationId: string,
  _prevState: UpdateClientActionState,
  formData: FormData,
): Promise<UpdateClientActionState> {
  await assertPlatformAdmin()

  const parsed = updateOrganizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    status: formData.get("status"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const { name, slug, status } = parsed.data
  const admin = createAdminClient()

  const current = await getOrganizationById(admin, organizationId)
  if (!current) {
    return { error: "Cliente não encontrado." }
  }

  if (slug !== current.slug && (await isSlugTaken(admin, slug))) {
    return { error: `O subdomínio "${slug}" já está em uso por outro cliente.` }
  }

  await updateOrganizationRow(admin, organizationId, { name, slug, status })

  revalidatePath("/clientes")
  return { error: null, success: true }
}
