"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireSessionUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCadastroMestreClient } from "@/lib/supabase/external-projects"
import {
  isSlugTaken, isEmailTaken, createOrganizationRow, getOrganizationById, updateOrganizationRow,
  deleteOrganizationCascade,
} from "@/services/organizations"
import { createOrganizationSchema, updateOrganizationSchema } from "@/lib/validations/organization"
import type { ActionState } from "@/app/login/actions"
import { provisionarClienteCrossSistema } from "@/services/provisioning/orchestrator"
import type { ProvisioningReport } from "@/services/provisioning/orchestrator"
import { provisionarBussola } from "@/services/provisioning/bussola"
import { provisionarOrigem } from "@/services/provisioning/origem"
import { provisionarDashboard } from "@/services/provisioning/dashboard"
import type { ProvisioningInput, ProvisioningStepResult } from "@/services/provisioning/types"

// Mesma constante de app/(app)/clientes/page.tsx e lib/supabase/middleware.ts
// — a organização "Lidera+" original (pré-multi-tenant) nunca pode ser
// excluída por aqui: é a própria instância raiz da Agência F4.
const DEFAULT_ORG_SLUG = "lidera-mais"

export type CreateClientActionState = {
  error: string | null
  success?: boolean
  slug?: string
  provisioning?: ProvisioningReport
  organizationId?: string
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

const RETRY_STEPS = { bussola: provisionarBussola, origem: provisionarOrigem, dashboard: provisionarDashboard } as const

export async function retryProvisioningStepAction(
  organizationId: string,
  etapa: keyof typeof RETRY_STEPS,
): Promise<ProvisioningStepResult> {
  await assertPlatformAdmin()

  const cm = createCadastroMestreClient()
  const { data: integracao, error } = await cm
    .from("integracao_sistema")
    .select("cliente_id")
    .eq("sistema", "lidera_mais")
    .eq("identificador_externo", organizationId)
    .maybeSingle()

  if (error || !integracao) {
    return { status: "erro", mensagem: "Cadastro Mestre ainda não foi provisionado para este cliente — não é possível repetir esta etapa isoladamente." }
  }

  // Reconstrói o ProvisioningInput a partir dos dados reais da organização no
  // Lidera+ em vez de confiar no que o navegador reenviar — o input original
  // (CreateClientActionState.provisioningInput) só existiu no state do
  // client component, e um retry com dados client-side obsoletos ou
  // adulterados poderia gravar nome/cidade errados ou convidar o e-mail
  // errado nos outros sistemas.
  const admin = createAdminClient()
  const org = await getOrganizationById(admin, organizationId)
  if (!org) {
    return { status: "erro", mensagem: "Organização não encontrada." }
  }

  const { data: adminProfile, error: adminProfileError } = await admin
    .from("users_profiles")
    .select("full_name, email")
    .eq("organization_id", organizationId)
    .eq("role", "admin_geral")
    .maybeSingle()

  if (adminProfileError) {
    return { status: "erro", mensagem: `Falha ao buscar o responsável da organização: ${adminProfileError.message}` }
  }
  if (!adminProfile || !adminProfile.email) {
    return { status: "erro", mensagem: "Nenhum Admin Geral encontrado para esta organização — não é possível repetir esta etapa." }
  }

  const input: ProvisioningInput = {
    organizationId,
    nome: org.name,
    cidade: org.cidade ?? "",
    adminEmail: adminProfile.email,
    adminNome: adminProfile.full_name,
  }

  try {
    return await RETRY_STEPS[etapa](input, integracao.cliente_id)
  } catch (err) {
    return { status: "erro", mensagem: `Falha inesperada ao provisionar: ${err instanceof Error ? err.message : "erro desconhecido"}` }
  }
}

export async function createClientAction(
  _prevState: CreateClientActionState,
  formData: FormData,
): Promise<CreateClientActionState> {
  await assertPlatformAdmin()

  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    cidade: formData.get("cidade"),
    admin_full_name: formData.get("admin_full_name"),
    admin_email: formData.get("admin_email"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const { name, slug, cidade, admin_full_name, admin_email } = parsed.data
  const admin = createAdminClient()

  if (await isSlugTaken(admin, slug)) {
    return { error: `O subdomínio "${slug}" já está em uso por outro cliente.` }
  }
  if (await isEmailTaken(admin, admin_email)) {
    return { error: `O e-mail "${admin_email}" já pertence a uma conta existente (de qualquer cliente).` }
  }

  const org = await createOrganizationRow(admin, name, slug, cidade)

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

  const provisioningInput: ProvisioningInput = {
    organizationId: org.id,
    nome: name,
    cidade,
    adminEmail: admin_email,
    adminNome: admin_full_name,
  }

  let provisioning: ProvisioningReport
  try {
    provisioning = await provisionarClienteCrossSistema(provisioningInput)
  } catch (err) {
    // A organização, o convite e o perfil no Lidera+ já foram commitados com
    // sucesso neste ponto — um erro inesperado aqui (ex.: env var de service
    // role de um dos sistemas externos ausente/mal configurada, que
    // createBussolaClient/createOrigemClient/createDashboardClient lançam via
    // envOrThrow) não deve desfazer isso. Reporta as 4 etapas como erro pra a
    // UI oferecer retry por etapa, mas mantém success:true da parte que já
    // commitou.
    const mensagem = `Falha inesperada ao provisionar: ${err instanceof Error ? err.message : "erro desconhecido"}`
    const falhaGenerica = { status: "erro" as const, mensagem }
    provisioning = { cadastroMestre: falhaGenerica, bussola: falhaGenerica, origem: falhaGenerica, dashboard: falhaGenerica }
  }

  revalidatePath("/clientes")
  return { error: null, success: true, slug: org.slug, provisioning, organizationId: org.id }
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
    plan: formData.get("plan"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const { name, slug, status, plan } = parsed.data
  const admin = createAdminClient()

  const current = await getOrganizationById(admin, organizationId)
  if (!current) {
    return { error: "Cliente não encontrado." }
  }

  if (slug !== current.slug && (await isSlugTaken(admin, slug))) {
    return { error: `O subdomínio "${slug}" já está em uso por outro cliente.` }
  }

  await updateOrganizationRow(admin, organizationId, { name, slug, status, plan })

  revalidatePath("/clientes")
  return { error: null, success: true }
}

/**
 * Apaga a organização inteira (lideranças, apoiadores, demandas,
 * atendimentos, agenda, mensagens, interações, notificações, anexos e todos
 * os logins) — irreversível. Duas travas antes de chegar no
 * deleteOrganizationCascade: nunca a organização raiz (lidera-mais) e nunca
 * a própria organização de quem está executando (evita a Agência F4 se
 * auto-excluir da instância em que está logada).
 */
export async function deleteClientAction(
  organizationId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  const session = await assertPlatformAdmin()

  const admin = createAdminClient()
  const org = await getOrganizationById(admin, organizationId)
  if (!org) {
    return { error: "Cliente não encontrado." }
  }

  if (org.slug === DEFAULT_ORG_SLUG) {
    return { error: "A organização raiz (Lidera+) não pode ser excluída por aqui." }
  }

  if (organizationId === session.profile.organization_id) {
    return { error: "Você não pode excluir a organização em que está logado." }
  }

  try {
    await deleteOrganizationCascade(admin, organizationId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao excluir cliente." }
  }

  revalidatePath("/clientes")
  redirect("/clientes")
}
