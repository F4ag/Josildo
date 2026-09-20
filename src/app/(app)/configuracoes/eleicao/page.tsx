import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ElectionForm } from "./election-form"

export const metadata: Metadata = { title: "Eleição · Lidera+" }

// Acesso restrito a admin_geral — já garantido pelo middleware.ts
// (ADMIN_GERAL_ONLY_ROUTE_PREFIXES em src/lib/permissions.ts).
export default async function EleicaoConfigPage() {
  const session = await getSessionUser()
  const supabase = await createClient()
  const { data: org } = await supabase
    .from("organizations")
    .select("election_year, election_cargo, election_candidate_number")
    .eq("id", session!.profile.organization_id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Eleição</h1>
        <p className="text-sm text-foreground/60">
          Configure o cargo, o número do candidato e o ano da eleição para habilitar o comparativo entre a
          expectativa de votos e o resultado real, importado automaticamente do TSE após a apuração.
        </p>
      </div>

      <ElectionForm
        current={{
          election_year: org?.election_year ?? null,
          election_cargo: org?.election_cargo ?? null,
          election_candidate_number: org?.election_candidate_number ?? null,
        }}
      />
    </div>
  )
}
