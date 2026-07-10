import { z } from "zod"
import { AGENDA_STATUSES } from "@/types/domain"

// Só título e data são obrigatórios — mesmo espírito do cadastro rápido de
// demanda/atendimento (ver lib/validations/demand.ts): a liderança em campo
// precisa conseguir marcar um compromisso rápido, sem preencher tudo.
export const agendaEventSchema = z.object({
  title: z.string().min(3, "Dê um título curto para o compromisso."),
  description: z.string().optional(),
  event_date: z.string().min(1, "Informe a data do compromisso."),
  event_time: z.string().optional().or(z.literal("")),
  location: z.string().optional(),
  neighborhood: z.string().optional(),
  leader_id: z.string().uuid().optional().or(z.literal("")),
  supporter_id: z.string().uuid().optional().or(z.literal("")),
  responsible_user_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
})
export type AgendaEventFormInput = z.infer<typeof agendaEventSchema>

export const agendaStatusUpdateSchema = z.object({
  status: z.enum(AGENDA_STATUSES),
})
export type AgendaStatusUpdateInput = z.infer<typeof agendaStatusUpdateSchema>
