export type ProvisioningStepResult =
  | { status: "ok" }
  | { status: "erro"; mensagem: string }

export type ProvisioningInput = {
  organizationId: string // id da organization no Lidera+ — usado como identificador_externo
  nome: string
  cidade: string
  adminEmail: string
  adminNome: string
}
