import "server-only"
import { createOrigemClient, createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

export async function provisionarOrigem(
  input: ProvisioningInput,
  clienteId: string,
): Promise<ProvisioningStepResult> {
  const cm = createCadastroMestreClient()
  const { data: jaFeito } = await cm
    .from("integracao_sistema")
    .select("identificador_externo")
    .eq("cliente_id", clienteId)
    .eq("sistema", "origem")
    .maybeSingle()
  if (jaFeito) return { status: "ok" }

  const origem = createOrigemClient()
  const { data: org, error: orgError } = await origem
    .from("organizations")
    .insert({ name: input.nome })
    .select("id")
    .single()
  if (orgError) return { status: "erro", mensagem: `Origem (organização): ${orgError.message}` }

  const { error: projectError } = await origem
    .from("brand_projects")
    .insert({ organization_id: org.id, name: input.nome, status: "draft" })
  if (projectError) {
    await origem.from("organizations").delete().eq("id", org.id)
    return { status: "erro", mensagem: `Origem (projeto de marca): ${projectError.message}` }
  }

  const { data: invited, error: inviteError } = await origem.auth.admin.inviteUserByEmail(input.adminEmail)
  if (inviteError || !invited.user) {
    // brand_projects (filho, referencia organization_id) precisa sair antes
    // da organização (pai) — o exemplo original só apagava a organização e
    // deixava o brand_project órfão.
    await origem.from("brand_projects").delete().eq("organization_id", org.id)
    await origem.from("organizations").delete().eq("id", org.id)
    return { status: "erro", mensagem: `Origem (convite): ${inviteError?.message ?? "erro desconhecido"}` }
  }

  const { error: memberError } = await origem
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: invited.user.id, role: "owner" })
  if (memberError) {
    await origem.auth.admin.deleteUser(invited.user.id)
    await origem.from("brand_projects").delete().eq("organization_id", org.id)
    await origem.from("organizations").delete().eq("id", org.id)
    return { status: "erro", mensagem: `Origem (membro): ${memberError.message}` }
  }

  const { error: integracaoError } = await cm.from("integracao_sistema").insert({
    cliente_id: clienteId,
    sistema: "origem",
    identificador_externo: org.id,
  })
  if (integracaoError) {
    // Mesmo raciocínio do passo do convite: sem isso um retry duplicaria
    // organização + brand_project + membro, pois o check de idempotência só
    // olha integracao_sistema (que é o insert que acabou de falhar). Ordem:
    // organization_members (filho de org+user) -> usuário de auth ->
    // brand_projects (filho de org) -> organizations (pai).
    await origem.from("organization_members").delete().eq("organization_id", org.id)
    await origem.auth.admin.deleteUser(invited.user.id)
    await origem.from("brand_projects").delete().eq("organization_id", org.id)
    await origem.from("organizations").delete().eq("id", org.id)
    return { status: "erro", mensagem: `Origem (registrar integração): ${integracaoError.message}` }
  }

  return { status: "ok" }
}
