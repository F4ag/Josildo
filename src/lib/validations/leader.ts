import { z } from "zod"
import { LEADER_TYPES, INFLUENCE_LEVELS, LEADER_STATUSES } from "@/types/domain"

// Só nome é estritamente obrigatório no cadastro de liderança — os demais
// campos operacionais (bairro, tipo, etc.) enriquecem filtros e relatórios,
// mas não bloqueiam o cadastro rápido em campo.
export const leaderSchema = z.object({
  name: z.string().min(3, "Informe o nome completo."),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  leader_type: z.enum(LEADER_TYPES).optional().or(z.literal("")),
  influence_level: z.enum(INFLUENCE_LEVELS).optional().or(z.literal("")),
  status: z.enum(LEADER_STATUSES).default("ativa"),
  can_view_attendances: z.coerce.boolean().default(false),
  notes: z.string().optional(),
})

export type LeaderFormInput = z.infer<typeof leaderSchema>
