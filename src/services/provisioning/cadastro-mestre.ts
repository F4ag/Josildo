import "server-only"
import { createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

/**
 * Idempotente e livre de race: delega a criação/reaproveitamento do cliente
 * pra uma função de banco (provisionar_cliente_lidera_mais, ver migration
 * provisionar_cliente_lidera_mais_atomico no projeto Cadastro Mestre) que
 * serializa por organizationId via advisory lock — duas chamadas
 * concorrentes pro mesmo organizationId nunca mais criam cliente duplicado.
 */
export async function provisionarCadastroMestre(
  input: ProvisioningInput,
): Promise<ProvisioningStepResult & { clienteId?: string }> {
  const cm = createCadastroMestreClient()

  const { data: clienteId, error } = await cm.rpc("provisionar_cliente_lidera_mais", {
    p_nome: input.nome,
    p_cidade: input.cidade,
    p_organization_id: input.organizationId,
  })

  if (error) {
    return { status: "erro", mensagem: `Falha ao provisionar cliente: ${error.message}` }
  }

  if (typeof clienteId !== "string") {
    return { status: "erro", mensagem: "RPC não retornou um clienteId válido." }
  }

  return { status: "ok", clienteId }
}
