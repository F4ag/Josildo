import { z } from "zod"

// Mesmos valores do CHECK constraint organizations.election_cargo (ver
// supabase/schema.sql) e do mapa CARGO_TSE_LABEL na Edge Function
// import-election-results — se adicionar um cargo aqui, adicionar nos
// três lugares.
export const ELECTION_CARGOS = [
  "prefeito", "vice_prefeito", "vereador",
  "governador", "vice_governador", "senador",
  "deputado_federal", "deputado_estadual",
] as const

export const ELECTION_CARGO_LABELS: Record<(typeof ELECTION_CARGOS)[number], string> = {
  prefeito: "Prefeito",
  vice_prefeito: "Vice-Prefeito",
  vereador: "Vereador",
  governador: "Governador",
  vice_governador: "Vice-Governador",
  senador: "Senador",
  deputado_federal: "Deputado Federal",
  deputado_estadual: "Deputado Estadual",
}

export const electionSettingsSchema = z.object({
  election_year: z.coerce.number().int().min(2020, "Ano inválido.").max(2100, "Ano inválido."),
  election_cargo: z.enum(ELECTION_CARGOS, { errorMap: () => ({ message: "Selecione o cargo." }) }),
  election_candidate_number: z
    .string()
    .trim()
    .min(1, "Informe o número do candidato.")
    .regex(/^\d+$/, "Use só números, sem pontos ou espaços (o mesmo número da urna)."),
})

export type ElectionSettingsInput = z.infer<typeof electionSettingsSchema>
