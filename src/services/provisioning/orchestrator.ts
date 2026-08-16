import "server-only"
import { provisionarCadastroMestre } from "./cadastro-mestre"
import { provisionarBussola } from "./bussola"
import { provisionarOrigem } from "./origem"
import { provisionarDashboard } from "./dashboard"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

export type ProvisioningReport = {
  cadastroMestre: ProvisioningStepResult
  bussola: ProvisioningStepResult
  origem: ProvisioningStepResult
  dashboard: ProvisioningStepResult
}

// Cadastro Mestre sempre primeiro — os outros 3 dependem do clienteId dele
// pra checar idempotência (integracao_sistema). Bússola/Origem/Dashboard
// rodam em paralelo entre si: são independentes um do outro.
async function runProvisioning(input: ProvisioningInput): Promise<ProvisioningReport> {
  const cmResult = await provisionarCadastroMestre(input)

  if (cmResult.status === "erro" || !cmResult.clienteId) {
    const naoIniciado: ProvisioningStepResult = { status: "erro", mensagem: "Não iniciado — Cadastro Mestre falhou primeiro." }
    return { cadastroMestre: cmResult, bussola: naoIniciado, origem: naoIniciado, dashboard: naoIniciado }
  }

  const [bussola, origem, dashboard] = await Promise.all([
    provisionarBussola(input, cmResult.clienteId),
    provisionarOrigem(input, cmResult.clienteId),
    provisionarDashboard(input, cmResult.clienteId),
  ])

  return { cadastroMestre: cmResult, bussola, origem, dashboard }
}

/**
 * Dedupe em memória por organizationId: fecha a mesma janela de race que o
 * advisory lock do Cadastro Mestre (Layer 1) só cobre pra aquela etapa
 * específica. Bússola/Origem/Dashboard têm o mesmo formato TOCTOU no próprio
 * check de idempotência (SELECT integracao_sistema) e não temos acesso DDL
 * pra aplicar o mesmo advisory lock lá — então a defesa fica na origem: duas
 * chamadas concorrentes de provisionarClienteCrossSistema pro mesmo
 * organizationId reaproveitam a MESMA promise em vez de rodar o pipeline
 * inteiro duas vezes.
 *
 * Limitação conhecida: isso é local ao processo Node. Se este app rodar com
 * mais de uma réplica/instância, cada processo tem seu próprio mapa e a
 * dedupe não protege entre processos. Aceitável hoje porque o deploy atual é
 * de instância única — não é uma lacuna sendo introduzida silenciosamente,
 * é uma limitação assumida dado o deploy atual.
 */
const emAndamento = new Map<string, Promise<ProvisioningReport>>()

export function provisionarClienteCrossSistema(input: ProvisioningInput): Promise<ProvisioningReport> {
  const existente = emAndamento.get(input.organizationId)
  if (existente) return existente

  const execucao = runProvisioning(input).finally(() => {
    emAndamento.delete(input.organizationId)
  })
  emAndamento.set(input.organizationId, execucao)
  return execucao
}
