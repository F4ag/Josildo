// Troca o token de acesso permanente de uma liderança
// (leader_access_tokens, ver src/services/leader-access.ts) por uma sessão
// de verdade: gera um
// magic link do Supabase na hora (admin.generateLink) e delega a
// verificação (verifyOtp) pra rota já existente /auth/confirm, que já faz
// exatamente isso pra outros fluxos de e-mail deste projeto — ver
// docs/08-acesso-lideranca-sem-senha.md §7.
import { redirect } from "next/navigation"
import { type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  // Duas consultas em vez de um join: leader_access_tokens tem RLS ativa e
  // nenhuma policy (só o client de service_role chega nela), então ela fica
  // isolada de propósito — é o que impede qualquer outra conta de ler o
  // token daqui (ver docs/08-acesso-lideranca-sem-senha.md §4.1).
  const { data: accessToken } = await admin
    .from("leader_access_tokens")
    .select("leader_id")
    .eq("token", token)
    .maybeSingle()

  if (!accessToken) {
    redirect("/login?erro=link_invalido")
  }

  const { data: leader } = await admin
    .from("leaders")
    .select("user_id")
    .eq("id", accessToken.leader_id)
    .maybeSingle()

  if (!leader?.user_id) {
    redirect("/login?erro=link_invalido")
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(leader.user_id)
  if (userError || !userData.user?.email) {
    redirect("/login?erro=link_invalido")
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  })
  if (linkError || !linkData.properties?.hashed_token) {
    redirect("/login?erro=link_invalido")
  }

  redirect(
    `/auth/confirm?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=magiclink&next=/dashboard`,
  )
}
