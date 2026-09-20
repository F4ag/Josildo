import { z } from "zod"

// Slug vira subdomínio (slug.lideramais.app.br) — mesma regra do CHECK
// constraint organizations_slug_check no banco (supabase/schema.sql):
// minúsculas, números e hífen simples entre blocos, sem começar/terminar
// com hífen. Validar aqui também evita round-trip até o Postgres só pra
// descobrir que o slug é inválido.
const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Cidade/UF de referência da eleição do cliente — não têm CHECK constraint no
// banco (nullable, texto livre). Fonte única de "cidade" do cliente: além de
// alimentar o provisionamento territorial no Dashboard (rpas/bairros) e a
// tabela neighborhoods aqui no Lidera+, election_city também é o que
// provisiona o cliente nos outros sistemas do ecossistema (Cadastro Mestre/
// Bússola/Origem/Dashboard — ver createClientAction) — por isso é
// obrigatório no cadastro (não dá pra provisionar sem cidade), mesmo sem
// CHECK constraint no banco. election_state continua só recomendado: o
// provisionamento cross-sistema não usa UF, só a tabela neighborhoods usa.
export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente/organização."),
  slug: z
    .string()
    .min(2, "Informe o subdomínio.")
    .max(63, "Subdomínio muito longo.")
    .regex(slugRegex, "Use só letras minúsculas, números e hífen (ex.: nome-do-cliente)."),
  admin_full_name: z.string().min(3, "Informe o nome do responsável (Admin Geral)."),
  admin_email: z.string().min(1, "Informe o e-mail do responsável.").email("E-mail inválido."),
  election_city: z.string().min(2, "Informe a cidade onde o cliente atua."),
  election_state: z.string().optional(),
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
  election_city: z.string().optional(),
  election_state: z.string().optional(),
})

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
