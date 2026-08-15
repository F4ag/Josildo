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
export async function provisionarClienteCrossSistema(input: ProvisioningInput): Promise<ProvisioningReport> {
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
