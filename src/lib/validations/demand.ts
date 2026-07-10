import { z } from "zod"
import { DEMAND_TYPES, PRIORITIES, DEMAND_STATUSES } from "@/types/domain"

export const demandSchema = z.object({
  title: z.string().min(3, "Dê um título curto para a demanda."),
  description: z.string().optional(),
  demand_type: z.enum(DEMAND_TYPES).optional().or(z.literal("")),
  leader_id: z.string().uuid().optional().or(z.literal("")),
  supporter_id: z.string().uuid().optional().or(z.literal("")),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  // Ver comentário equivalente em lib/validations/leader.ts sobre por que
  // isto é string aqui (não z.coerce.number()) e só vira number|null na
  // action: sem essas coordenadas a demanda nunca aparece no Mapa Territorial.
  latitude: z.string().optional().refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90),
    "Latitude inválida (use algo entre -90 e 90).",
  ),
  longitude: z.string().optional().refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180),
    "Longitude inválida (use algo entre -180 e 180).",
  ),
  // Demandas não têm coluna zip_code no banco (schema.sql só tem isso em
  // leaders/supporters) — este campo existe só no formulário, pra ajudar
  // o geocodeAddress a achar a localização; nunca é salvo no registro (ver
  // demandas/actions.ts, que remove antes de montar o DemandInput).
  zip_code: z.string().optional(),
  priority: z.enum(PRIORITIES).default("media"),
  due_date: z.string().optional().or(z.literal("")),
  public_agency: z.string().optional(),
})
export type DemandFormInput = z.infer<typeof demandSchema>

export const demandStatusUpdateSchema = z.object({
  status: z.enum(DEMAND_STATUSES),
  comment: z.string().optional(),
  result_description: z.string().optional(),
})
export type DemandStatusUpdateInput = z.infer<typeof demandStatusUpdateSchema>
