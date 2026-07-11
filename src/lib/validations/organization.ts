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
