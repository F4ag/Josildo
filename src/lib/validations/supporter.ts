import { z } from "zod"
import { SUPPORTER_ORIGINS } from "@/types/domain"

// Campos obrigatórios conforme o Módulo 4 do prompt master: nome, endereço,
// WhatsApp e data de nascimento. O resto enriquece filtro/relatório.
export const supporterSchema = z.object({
  name: z.string().min(3, "Informe o nome completo."),
  phone: z.string().min(8, "Informe um WhatsApp válido com DDD."),
  birth_date: z.string().min(1, "Informe a data de nascimento."),
  address: z.string().min(3, "Informe o endereço."),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  // Local de votação (autocomplete sobre polling_locations, dado do TSE) —
  // mesma lógica de leader.ts: o campo de texto é só exibição, o id
  // selecionado vem de um input hidden preenchido pelo componente.
  polling_location_id: z.string().uuid().optional().or(z.literal("")),
  // Mesma lógica de leader.ts/demand.ts: string em vez de z.coerce.number()
  // pra não transformar "" em 0 (Null Island) — a conversão pra number|null
  // é feita à mão na Server Action, só depois de decidir se vamos usar o
  // valor manual ou tentar geocodificar pelo endereço/CEP.
  latitude: z.string().optional().refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90),
    "Latitude inválida (use algo entre -90 e 90).",
  ),
  longitude: z.string().optional().refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180),
    "Longitude inválida (use algo entre -180 e 180).",
  ),
  leader_id: z.string().uuid().optional().or(z.literal("")),
  origin: z.enum(SUPPORTER_ORIGINS).optional().or(z.literal("")),
  gender: z.string().optional(),
  profession: z.string().optional(),
  consent_whatsapp: z.coerce.boolean().default(false),
  consent_email: z.coerce.boolean().default(false),
  // Módulo 15 (LGPD): sem esta autorização o cadastro não é salvo — texto
  // padrão sugerido no prompt master é exibido ao lado do checkbox no form.
  consent_registration: z.coerce.boolean().refine((v) => v === true, {
    message: "É preciso confirmar a autorização de cadastro (LGPD) para continuar.",
  }),
  notes: z.string().optional(),
})

export type SupporterFormInput = z.infer<typeof supporterSchema>
