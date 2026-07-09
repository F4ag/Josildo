import { z } from "zod"
import { ATTENDANCE_TYPES, PRIORITIES, ATTENDANCE_STATUSES } from "@/types/domain"

export const attendanceSchema = z.object({
  // Regra obrigatória do Módulo 7: todo atendimento é vinculado a uma pessoa.
  supporter_id: z.string().uuid("Selecione a pessoa atendida."),
  leader_id: z.string().uuid().optional().or(z.literal("")),
  attendance_type: z.enum(ATTENDANCE_TYPES, { errorMap: () => ({ message: "Selecione o tipo de atendimento." }) }),
  title: z.string().min(3, "Dê um título curto para o atendimento."),
  description: z.string().optional(),
  priority: z.enum(PRIORITIES).default("media"),
  due_date: z.string().optional().or(z.literal("")),
})
export type AttendanceFormInput = z.infer<typeof attendanceSchema>

export const attendanceStatusUpdateSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
  result_description: z.string().optional(),
  return_sent: z.coerce.boolean().default(false),
  return_channel: z.enum(["whatsapp", "email", "ligacao", "presencial", "outro"]).optional().or(z.literal("")),
})
export type AttendanceStatusUpdateInput = z.infer<typeof attendanceStatusUpdateSchema>
