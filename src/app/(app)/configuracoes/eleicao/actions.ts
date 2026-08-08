"use server"

import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { electionSettingsSchema } from "@/lib/validations/election"
import type { ActionState } from "@/app/login/actions"

async function assertAdminGeral() {
  const session = await requireSessionUser()
  if (session.profile.role !== "admin_geral") {
    throw new Error("Apenas o Admin Geral pode configurar a eleição.")
  }
  return session
}

// Atualiza só a própria organização do Admin Geral logado — nunca recebe
// organization_id do form, sempre usa session.profile.organization_id, pra
// não dar brecha de um admin_geral de um cliente editar outro (RLS também
// bloquearia isso, mas não custa não depender só dela aqui).
export async function updateElectionSettings(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await assertAdminGeral()

  const parsed = electionSettingsSchema.safeParse({
    election_year: formData.get("election_year"),
    election_cargo: formData.get("election_cargo"),
    election_candidate_number: formData.get("election_candidate_number"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", session.profile.organization_id)

  if (error) {
    return { error: `Não foi possível salvar: ${error.message}` }
  }

  revalidatePath("/configuracoes/eleicao")
  return { error: null, success: true }
}
