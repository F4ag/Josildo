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
