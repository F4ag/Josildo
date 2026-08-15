import "server-only"
import { createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

/**
 * Idempotente: identifica um cliente já provisionado por este mesmo
 * organizationId do Lidera+ via integracao_sistema (sistema='lidera_mais').
 * Se já existir, reaproveita — nunca cria um cliente duplicado ao reexecutar
 * uma etapa que falhou depois desta.
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
    return { status: "erro", mensagem: `Falha ao criar campanha: ${campanhaError.message}` }
  }

  const { error: integracaoError } = await cm.from("integracao_sistema").insert({
    cliente_id: cliente.id,
    sistema: "lidera_mais",
    identificador_externo: input.organizationId,
  })

  if (integracaoError) {
    return { status: "erro", mensagem: `Falha ao registrar integração: ${integracaoError.message}` }
  }

  return { status: "ok", clienteId: cliente.id }
}
