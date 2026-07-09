import { type EmailOtpType } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Ponto único de confirmação de e-mail do Supabase Auth: recebe o
// `token_hash` que o Supabase anexa ao link enviado por e-mail (recuperação
// de senha, e futuramente confirmação de cadastro), troca por uma sessão e
// redireciona para `next`. Usado pelo fluxo "Recuperação de senha" do
// Módulo 1 do prompt master.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/redefinir-senha"

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      redirect(next)
    }
  }

  redirect("/login?erro=link_invalido")
}
