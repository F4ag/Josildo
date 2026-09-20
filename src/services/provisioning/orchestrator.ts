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
 * Dedupe em memória por organizationId: se duas chamadas concorrentes de
 * provisionarClienteCrossSistema chegarem com o MESMO organizationId já
 * conhecido (ex.: duplo clique num retry de uma etapa já provisionada),
 * reaproveitam a MESMA promise em vez de rodar o pipeline inteiro duas vezes.
 * Esse é o único caso que este mapa protege.
 *
 * O que isso NÃO cobre: no fluxo de criação, organizationId é um UUID recém
 * gerado por createOrganizationRow imediatamente antes de chamar o
 * orchestrator — dois cliques rápidos de double-submit no navegador geram
 * dois organizationId diferentes (uma chave de mapa diferente cada), então a
 * dedupe não tem como enxergar esse caso. E não é a defesa principal contra a
 * duplicação encontrada em teste E2E ao vivo (ver ledger da Task 8): lá, a
 * duplicação ocorreu de um jeito que nenhuma dedupe em nível de aplicação
 * consegue observar — as próprias requisições HTTP ao Supabase pareceram
 * duplicar abaixo da camada da aplicação. Quem fecha essa lacuna
 * independente da causa raiz são as constraints de unicidade em nível de
 * banco (adicionadas diretamente no projeto Cadastro Mestre e capturadas
 * neste branch em
 * supabase/migrations/2026-08-15_cadastro_mestre_provisionar_cliente_lidera_mais.sql).
 *
 * Limitação conhecida (ainda válida, mesmo com o acima): isso é local ao
 * processo Node. Se este app rodar com mais de uma réplica/instância, cada
 * processo tem seu próprio mapa e a dedupe não protege entre processos.
 * Aceitável hoje porque o deploy atual é de instância única — não é uma
 * lacuna sendo introduzida silenciosamente, é uma limitação assumida dado o
 * deploy atual.
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
