import "server-only"
import { createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

/**
 * Idempotente: identifica um cliente já provisionado por este mesmo
 * organizationId do Lidera+ via integracao_sistema (sistema='lidera_mais').
 * Se já existir, reaproveita — nunca cria um cliente duplicado ao reexecutar
 * uma etapa que falhou depois desta.
 *
 * TOCTOU risk (Time of Check, Time of Use): duas chamadas concorrentes para
 * o mesmo organizationId podem ambas passar neste check antes que qualquer uma
 * escreva integracao_sistema, criando duplicatas. Aceitável em produção pois
 * este é um gatilho admin de baixa frequência, não tráfego high-concurrency.
 */
export async function provisionarCadastroMestre(
  input: ProvisioningInput,
): Promise<ProvisioningStepResult & { clienteId?: string }> {
  const cm = createCadastroMestreClient()

  const { data: existente, error: buscaError } = await cm
    .from("integracao_sistema")
    .select("cliente_id")
    .eq("sistema", "lidera_mais")
    .eq("identificador_externo", input.organizationId)
    .maybeSingle()

  if (buscaError) {
    return { status: "erro", mensagem: `Falha ao checar cliente existente: ${buscaError.message}` }
  }
  if (existente) {
    return { status: "ok", clienteId: existente.cliente_id }
  }

  const { data: cliente, error: clienteError } = await cm
    .from("cliente")
    .insert({ nome: input.nome, cidade: input.cidade })
    .select("id")
    .single()

  if (clienteError) {
    return { status: "erro", mensagem: `Falha ao criar cliente: ${clienteError.message}` }
  }

  const { error: campanhaError } = await cm
    .from("campanha")
    .insert({ cliente_id: cliente.id, nome: "Campanha", status: "planejamento" })

  if (campanhaError) {
    const { error: rollbackClienteError } = await cm.from("cliente").delete().eq("id", cliente.id)
    if (rollbackClienteError) console.error("[provisioning:cadastro-mestre] falha ao desfazer cliente (rollback campanha):", rollbackClienteError)
    return { status: "erro", mensagem: `Falha ao criar campanha: ${campanhaError.message}` }
  }

  const { error: integracaoError } = await cm.from("integracao_sistema").insert({
    cliente_id: cliente.id,
    sistema: "lidera_mais",
    identificador_externo: input.organizationId,
  })

  if (integracaoError) {
    const { error: rollbackCampanhaError } = await cm.from("campanha").delete().eq("cliente_id", cliente.id)
    if (rollbackCampanhaError) console.error("[provisioning:cadastro-mestre] falha ao desfazer campanha (rollback integração):", rollbackCampanhaError)
    const { error: rollbackClienteError } = await cm.from("cliente").delete().eq("id", cliente.id)
    if (rollbackClienteError) console.error("[provisioning:cadastro-mestre] falha ao desfazer cliente (rollback integração):", rollbackClienteError)
    return { status: "erro", mensagem: `Falha ao registrar integração: ${integracaoError.message}` }
  }

  return { status: "ok", clienteId: cliente.id }
}
