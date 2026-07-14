import { z } from "zod"

// Slug vira subdomínio (slug.lideramais.app.br) — mesma regra do CHECK
// constraint organizations_slug_check no banco (supabase/schema.sql):
// minúsculas, números e hífen simples entre blocos, sem começar/terminar
// com hífen. Validar aqui também evita round-trip até o Postgres só pra
// descobrir que o slug é inválido.
const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente/organização."),
  slug: z
    .string()
    .min(2, "Informe o subdomínio.")
    .max(63, "Subdomínio muito longo.")
    .regex(slugRegex, "Use só letras minúsculas, números e hífen (ex.: nome-do-cliente)."),
  admin_full_name: z.string().min(3, "Informe o nome do responsável (Admin Geral)."),
  admin_email: z.string().min(1, "Informe o e-mail do responsável.").email("E-mail inválido."),
})

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>

// Edição toca todos os campos editáveis da organização (nome/subdomínio/
// status/plano) — o responsável (Admin Geral) é gerenciado à parte, em
// configuracoes/usuarios, pelo próprio cliente. Ver comentário em
// supabase/schema.sql: status é 'ativa' | 'suspensa' | 'cancelada' (CHECK
// constraint da tabela); "plan" não tem CHECK constraint no banco (texto
// livre, default 'padrao'), por isso aqui é só "não vazio".
export const updateOrganizationSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente/organização."),
  slug: z
    .string()
    .min(2, "Informe o subdomínio.")
    .max(63, "Subdomínio muito longo.")
    .regex(slugRegex, "Use só letras minúsculas, números e hífen (ex.: nome-do-cliente)."),
  status: z.enum(["ativa", "suspensa", "cancelada"]),
  plan: z.string().min(1, "Informe o plano."),
})

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
