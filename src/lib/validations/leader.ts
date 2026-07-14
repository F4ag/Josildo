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
  // Local de votação (autocomplete sobre polling_locations, dado do TSE) —
  // o campo de texto é só exibição; o que realmente é salvo é o id
  // selecionado, escrito num input hidden por
  // components/polling-location-autocomplete.tsx.
  polling_location_id: z.string().uuid().optional().or(z.literal("")),
  // Usadas pelo Mapa Territorial (Módulo 8) — sem isso preenchido no
  // cadastro, a liderança nunca aparece no mapa mesmo com endereço/bairro
  // certos. Mantidas como string aqui (a conversão pra number|null acontece
  // na action) de propósito: z.coerce.number() em cima de "" vira 0 em vez
  // de falhar, e 0,0 é uma coordenada real no oceano ("Null Island") — não
  // é o mesmo que "não preenchido".
  latitude: z.string().optional().refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90),
    "Latitude inválida (use algo entre -90 e 90).",
  ),
  longitude: z.string().optional().refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180),
    "Longitude inválida (use algo entre -180 e 180).",
  ),
  leader_type: z.enum(LEADER_TYPES).optional().or(z.literal("")),
  influence_level: z.enum(INFLUENCE_LEVELS).optional().or(z.literal("")),
  status: z.enum(LEADER_STATUSES).default("ativa"),
  can_view_attendances: z.coerce.boolean().default(false),
  // Mesma lógica de string→number da lat/lng acima: z.coerce.number() em
  // cima de "" não falha, vira 0 — e 0 votos é um valor real, diferente de
  // "não preenchido". A conversão pra number|null acontece na action.
  // expected_votes: a liderança diz quantos votos acha que entrega.
  // admin_estimated_votes: campo admin-only (ver comment em schema.sql) —
  // continua fazendo parte do schema pra poder ser lido do FormData quando
  // quem está no formulário é admin_geral/admin_equipe; a action zera esse
  // valor sempre que quem está editando é a própria liderança.
  expected_votes: z.string().optional().refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0),
    "Expectativa de votos inválida.",
  ),
  admin_estimated_votes: z.string().optional().refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0),
    "Expectativa de votos (admin) inválida.",
  ),
  notes: z.string().optional(),
})

export type LeaderFormInput = z.infer<typeof leaderSchema>
