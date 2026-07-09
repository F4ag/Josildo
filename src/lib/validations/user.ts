import { z } from "zod"

export const inviteUserSchema = z
  .object({
    full_name: z.string().min(3, "Informe o nome completo."),
    email: z.string().min(1, "Informe o e-mail.").email("E-mail inválido."),
    phone: z.string().optional(),
    role: z.enum(["admin_geral", "admin_equipe", "lideranca"], {
      errorMap: () => ({ message: "Selecione um perfil." }),
    }),
    leader_id: z.string().uuid().optional().or(z.literal("")),
  })
  .refine((data) => data.role !== "lideranca" || Boolean(data.leader_id), {
    message: "Selecione qual liderança este usuário vai representar.",
    path: ["leader_id"],
  })

export type InviteUserInput = z.infer<typeof inviteUserSchema>
