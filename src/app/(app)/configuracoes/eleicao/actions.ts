"use server"

import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createCadastroMestreClient } from "@/lib/supabase/external-projects"
import { electionSettingsSchema, ELECTION_CARGO_LABELS } from "@/lib/validations/election"
import type { ActionState } from "@/app/login/actions"

async function assertAdminGeral() {
  const session = await requireSessionUser()
  if (session.profile.role !== "admin_geral") {
    throw new Error("Apenas o Admin Geral pode configurar a eleição.")
  }
  return session
}

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

  // Propaga pro Cadastro Mestre — não bloqueia a resposta se falhar (dado já
  // está salvo aqui, que é o que importa pro usuário); só loga pra
  // diagnóstico manual depois.
  try {
    const cm = createCadastroMestreClient()
    const { data: integracao, error: integracaoError } = await cm
      .from("integracao_sistema")
      .select("cliente_id")
      .eq("sistema", "lidera_mais")
      .eq("identificador_externo", session.profile.organization_id)
      .maybeSingle()

    if (integracaoError) {
      console.error("[eleicao] falha ao consultar integracao_sistema no Cadastro Mestre:", integracaoError)
    } else if (integracao) {
      const { error: campanhaError } = await cm
        .from("campanha")
        .update({
          cargo: parsed.data.election_cargo ? ELECTION_CARGO_LABELS[parsed.data.election_cargo] : null,
          numero_urna: parsed.data.election_candidate_number,
          ano_eleicao: parsed.data.election_year,
        })
        .eq("cliente_id", integracao.cliente_id)

      if (campanhaError) {
        console.error("[eleicao] falha ao atualizar campanha no Cadastro Mestre:", campanhaError)
      }
    }
  } catch (propagationError) {
    console.error("[eleicao] falha ao propagar pro Cadastro Mestre:", propagationError)
  }

  revalidatePath("/configuracoes/eleicao")
  return { error: null, success: true }
}
