import "server-only"
import { createBussolaClient, createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

export async function provisionarBussola(
  input: ProvisioningInput,
  clienteId: string,
): Promise<ProvisioningStepResult> {
  const cm = createCadastroMestreClient()
  const { data: jaFeito, error: buscaError } = await cm
    .from("integracao_sistema")
    .select("identificador_externo")
    .eq("cliente_id", clienteId)
    .eq("sistema", "bussola")
    .maybeSingle()
  if (buscaError) return { status: "erro", mensagem: `Bússola (checar integração existente): ${buscaError.message}` }
  if (jaFeito) return { status: "ok" }

  const bussola = createBussolaClient()
  const { data: org, error: orgError } = await bussola
    .from("organizacoes")
    .insert({ nome: input.nome, slug: input.organizationId })
    .select("id")
    .single()
  if (orgError) return { status: "erro", mensagem: `Bússola (organização): ${orgError.message}` }

  const { data: invited, error: inviteError } = await bussola.auth.admin.inviteUserByEmail(input.adminEmail)
  if (inviteError || !invited.user) {
    const { error: rollbackOrgError } = await bussola.from("organizacoes").delete().eq("id", org.id)
    if (rollbackOrgError) console.error("[provisioning:bussola] falha ao desfazer organização (rollback convite):", rollbackOrgError)
    return { status: "erro", mensagem: `Bússola (convite): ${inviteError?.message ?? "erro desconhecido"}` }
  }

  // upsert (não insert): o próprio Bússola tem um trigger em auth.users que,
  // assim que inviteUserByEmail acima cria o usuário, já insere um stub em
  // perfis com esse mesmo id (papel 'analista', ativo false,
  // organization_id null) — um insert aqui colidiria sempre com
  // perfis_pkey. O upsert sobrescreve o stub com os valores corretos de
  // admin.
  const { error: perfilError } = await bussola.from("perfis").upsert({
    id: invited.user.id,
    nome: input.adminNome,
    email: input.adminEmail,
    papel: "admin",
    organization_id: org.id,
    ativo: true,
  })
  if (perfilError) {
    const { error: rollbackUserError } = await bussola.auth.admin.deleteUser(invited.user.id)
    if (rollbackUserError) console.error("[provisioning:bussola] falha ao desfazer usuário (rollback perfil):", rollbackUserError)
    const { error: rollbackOrgError } = await bussola.from("organizacoes").delete().eq("id", org.id)
    if (rollbackOrgError) console.error("[provisioning:bussola] falha ao desfazer organização (rollback perfil):", rollbackOrgError)
    return { status: "erro", mensagem: `Bússola (perfil): ${perfilError.message}` }
  }

  const { error: integracaoError } = await cm.from("integracao_sistema").insert({
    cliente_id: clienteId,
    sistema: "bussola",
    identificador_externo: org.id,
  })
  if (integracaoError) {
    // Sem este rollback, um retry recriaria organização/convite/perfil
    // duplicados: o check de idempotência no topo só olha integracao_sistema,
    // que é justamente o insert que falhou aqui. Ordem: filho (perfis) antes
    // do pai (organizacoes); usuário de auth apagado no meio pois perfis.id
    // referencia ele.
    const { error: rollbackPerfilError } = await bussola.from("perfis").delete().eq("id", invited.user.id)
    if (rollbackPerfilError) console.error("[provisioning:bussola] falha ao desfazer perfil (rollback integração):", rollbackPerfilError)
    const { error: rollbackUserError } = await bussola.auth.admin.deleteUser(invited.user.id)
    if (rollbackUserError) console.error("[provisioning:bussola] falha ao desfazer usuário (rollback integração):", rollbackUserError)
    const { error: rollbackOrgError } = await bussola.from("organizacoes").delete().eq("id", org.id)
    if (rollbackOrgError) console.error("[provisioning:bussola] falha ao desfazer organização (rollback integração):", rollbackOrgError)
    return { status: "erro", mensagem: `Bússola (registrar integração): ${integracaoError.message}` }
  }

  return { status: "ok" }
}
