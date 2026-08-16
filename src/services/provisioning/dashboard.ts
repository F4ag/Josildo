import "server-only"
import { createDashboardClient, createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

/**
 * Apaga rpas (e seus bairros) clonadas para o novo cliente. Usada tanto para
 * desfazer uma clonagem que falhou no meio quanto, no chamador, para desfazer
 * uma clonagem que teve sucesso mas cujo passo seguinte (registrar
 * integração) falhou depois. Bairros (filhos de rpas) são apagados antes das
 * próprias rpas (pai).
 */
async function limparRpasClonadas(
  dashboard: ReturnType<typeof createDashboardClient>,
  rpaIds: string[],
): Promise<void> {
  if (rpaIds.length === 0) return
  const { error: rollbackBairrosError } = await dashboard.from("bairros").delete().in("rpa_id", rpaIds)
  if (rollbackBairrosError) console.error("[provisioning:dashboard] falha ao desfazer bairros clonados:", rollbackBairrosError)
  const { error: rollbackRpasError } = await dashboard.from("rpas").delete().in("id", rpaIds)
  if (rollbackRpasError) console.error("[provisioning:dashboard] falha ao desfazer RPAs clonadas:", rollbackRpasError)
}

async function clonarTerritorioDaCidade(
  dashboard: ReturnType<typeof createDashboardClient>,
  cidadeReferencia: string,
  clienteIdNovo: string,
): Promise<ProvisioningStepResult> {
  // Acha um cliente_id existente que já tenha RPAs na mesma cidade — usa
  // cliente.cidade do Cadastro Mestre pra decidir, mas a comparação de
  // "mesma estrutura" aqui é simplificada: qualquer cliente_id com RPAs é
  // candidato a template (hoje só existe uma cidade por cliente_id). Se um
  // dia houver múltiplos clientes na mesma cidade, o primeiro encontrado
  // vira o template — comportamento aceitável dado o volume atual (2
  // clientes).
  const cm = createCadastroMestreClient()
  const { data: clientesNaCidade, error: clientesError } = await cm
    .from("cliente")
    .select("id")
    .eq("cidade", cidadeReferencia)
    .neq("id", clienteIdNovo)
  if (clientesError) {
    return { status: "erro", mensagem: `Dashboard (buscar clientes da cidade): ${clientesError.message}` }
  }

  const clienteTemplate = clientesNaCidade?.[0]
  if (!clienteTemplate) {
    return { status: "ok" } // cidade nova, sem estrutura — fica pendente de propósito
  }

  // Traz o id da própria rpa-template junto (além dos dados a copiar) — evita
  // um round-trip redundante pra redescobrir esse id só pra buscar os
  // bairros dela mais abaixo.
  const { data: rpasTemplate, error: rpasTemplateError } = await dashboard
    .from("rpas")
    .select("id, numero, nome, meta_ativa, observacoes")
    .eq("cliente_id", clienteTemplate.id)
  if (rpasTemplateError) {
    return { status: "erro", mensagem: `Dashboard (buscar RPAs template): ${rpasTemplateError.message}` }
  }

  if (!rpasTemplate || rpasTemplate.length === 0) {
    return { status: "ok" } // cliente daquela cidade existe mas ainda não tem território no Dashboard
  }

  const rpasClonadas: string[] = []

  for (const { id: rpaTemplateId, ...rpaDados } of rpasTemplate) {
    const { data: novaRpa, error: rpaError } = await dashboard
      .from("rpas")
      .insert({ ...rpaDados, cliente_id: clienteIdNovo })
      .select("id")
      .single()
    if (rpaError) {
      await limparRpasClonadas(dashboard, rpasClonadas)
      return { status: "erro", mensagem: `Dashboard (clonar RPA ${rpaDados.numero}): ${rpaError.message}` }
    }
    rpasClonadas.push(novaRpa.id)

    const { data: bairrosTemplate, error: bairrosTemplateError } = await dashboard
      .from("bairros")
      .select("nome, tipo, prioridade")
      .eq("rpa_id", rpaTemplateId)
    if (bairrosTemplateError) {
      await limparRpasClonadas(dashboard, rpasClonadas)
      return {
        status: "erro",
        mensagem: `Dashboard (buscar bairros da RPA ${rpaDados.numero}): ${bairrosTemplateError.message}`,
      }
    }

    for (const bairro of bairrosTemplate ?? []) {
      const { error: bairroError } = await dashboard.from("bairros").insert({ ...bairro, rpa_id: novaRpa.id })
      if (bairroError) {
        // Desfaz tudo que essa clonagem já criou (incluindo a rpa atual,
        // parcialmente populada) — senão um retry, que só checa
        // integracao_sistema, duplicaria as rpas/bairros já clonados.
        await limparRpasClonadas(dashboard, rpasClonadas)
        return { status: "erro", mensagem: `Dashboard (clonar bairro ${bairro.nome}): ${bairroError.message}` }
      }
    }
  }

  return { status: "ok" }
}

export async function provisionarDashboard(
  input: ProvisioningInput,
  clienteId: string,
): Promise<ProvisioningStepResult> {
  const cm = createCadastroMestreClient()
  const { data: jaFeito, error: buscaError } = await cm
    .from("integracao_sistema")
    .select("identificador_externo")
    .eq("cliente_id", clienteId)
    .eq("sistema", "dashboard")
    .maybeSingle()
  if (buscaError) return { status: "erro", mensagem: `Dashboard (checar integração existente): ${buscaError.message}` }
  if (jaFeito) return { status: "ok" }

  const dashboard = createDashboardClient()
  const { data: invited, error: inviteError } = await dashboard.auth.admin.inviteUserByEmail(input.adminEmail)
  if (inviteError || !invited.user) {
    return { status: "erro", mensagem: `Dashboard (convite): ${inviteError?.message ?? "erro desconhecido"}` }
  }

  const { error: perfilError } = await dashboard.from("perfis").insert({
    id: invited.user.id,
    nome: input.adminNome,
    email: input.adminEmail,
    papel: "admin",
    cliente_id: clienteId,
    ativo: true,
  })
  if (perfilError) {
    await dashboard.auth.admin.deleteUser(invited.user.id)
    return { status: "erro", mensagem: `Dashboard (perfil): ${perfilError.message}` }
  }

  const clonagem = await clonarTerritorioDaCidade(dashboard, input.cidade, clienteId)
  if (clonagem.status === "erro") {
    // clonarTerritorioDaCidade já desfez o que criou internamente — falta só
    // desfazer o perfil e o convite deste passo.
    const { error: rollbackPerfilError } = await dashboard.from("perfis").delete().eq("id", invited.user.id)
    if (rollbackPerfilError) console.error("[provisioning:dashboard] falha ao desfazer perfil (rollback clonagem):", rollbackPerfilError)
    await dashboard.auth.admin.deleteUser(invited.user.id)
    return clonagem
  }

  const { error: integracaoError } = await cm.from("integracao_sistema").insert({
    cliente_id: clienteId,
    sistema: "dashboard",
    identificador_externo: clienteId, // Dashboard usa cliente_id direto, sem id proprio de organizacao
  })
  if (integracaoError) {
    // Aqui a clonagem (se aconteceu) teve sucesso, então precisa ser desfeita
    // explicitamente — senão um retry duplicaria o território clonado, já
    // que o check de idempotência só olha integracao_sistema.
    const { data: rpasDoCliente, error: rpasDoClienteError } = await dashboard
      .from("rpas")
      .select("id")
      .eq("cliente_id", clienteId)
    if (rpasDoClienteError) {
      // Não sabemos quais rpas apagar — não tratamos como "nenhuma" (isso
      // deixaria o território clonado órfão em silêncio). Sinaliza o erro
      // combinado; perfil/usuário ainda são desfeitos abaixo.
      const { error: rollbackPerfilError } = await dashboard.from("perfis").delete().eq("id", invited.user.id)
      if (rollbackPerfilError) console.error("[provisioning:dashboard] falha ao desfazer perfil (rollback integração, sem saber quais rpas apagar):", rollbackPerfilError)
      await dashboard.auth.admin.deleteUser(invited.user.id)
      return {
        status: "erro",
        mensagem: `Dashboard (registrar integração): ${integracaoError.message}; falha adicional ao tentar desfazer território clonado: ${rpasDoClienteError.message}`,
      }
    }
    await limparRpasClonadas(dashboard, (rpasDoCliente ?? []).map((rpa) => rpa.id))
    const { error: rollbackPerfilError } = await dashboard.from("perfis").delete().eq("id", invited.user.id)
    if (rollbackPerfilError) console.error("[provisioning:dashboard] falha ao desfazer perfil (rollback integração):", rollbackPerfilError)
    await dashboard.auth.admin.deleteUser(invited.user.id)
    return { status: "erro", mensagem: `Dashboard (registrar integração): ${integracaoError.message}` }
  }

  return { status: "ok" }
}
