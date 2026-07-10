import { z } from "zod"
import { MESSAGE_TEMPLATE_TYPES } from "@/types/domain"

export const messageTemplateSchema = z.object({
  name: z.string().min(3, "Dê um nome curto para o modelo."),
  type: z.enum(MESSAGE_TEMPLATE_TYPES),
  subject: z.string().optional(),
  body: z.string().min(5, "Escreva o texto do modelo."),
})
export type MessageTemplateFormInput = z.infer<typeof messageTemplateSchema>
