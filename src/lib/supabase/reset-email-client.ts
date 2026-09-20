import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

/**
 * Cliente Supabase "solto" (sem @supabase/ssr, sem cookies) — usar SÓ pra
 * chamar resetPasswordForEmail.
 *
 * Por quê: os clients normais (lib/supabase/client.ts e server.ts) usam
 * @supabase/ssr, que força flowType "pkce" sem permitir override (ver
 * node_modules/@supabase/ssr/dist/module/createServerClient.js — o spread
 * de options.auth vem ANTES de `flowType: "pkce"`, então qualquer flowType
 * passado por quem chama é sobrescrito). Sob PKCE, resetPasswordForEmail
 * gera um "code_verifier" e grava num cookie do NAVEGADOR DE QUEM CHAMA a
 * função — aqui, sempre quem está autenticado disparando o convite/reset (o
 * admin_geral da campanha, ou a própria pessoa no formulário de "esqueci
 * senha"). O link vai por e-mail pra OUTRO navegador (o da liderança
 * convidada, quase sempre um aparelho diferente) — que nunca teve, e nunca
 * vai ter, esse cookie.
 *
 * Confirmado nos logs de auth do Supabase (projeto vqrnjiwansfobxaeswnu):
 * pra um convite real que falhou, o /verify do link aparece normalmente
 * (redireciona 303), mas nunca existe um /token depois — ou seja,
 * exchangeCodeForSession (chamado em app/redefinir-senha/actions.ts) nem
 * chega a fazer a requisição: o SDK barra localmente antes, com
 * AuthPKCECodeVerifierMissingError, assim que percebe que não existe
 * code_verifier salvo (ver node_modules/@supabase/auth-js/dist/module/
 * GoTrueClient.js, método _exchangeCodeForSession). Esse é o motivo real do
 * "Não foi possível redefinir a senha" acontecendo mesmo em link recém-
 * aberto, sem nenhum erro visível na URL.
 *
 * Client solto, sem @supabase/ssr, tem flowType "implicit" por padrão (não
 * setado aqui à toa — é o default do próprio pacote quando não é a versão
 * @supabase/ssr que força pkce). Sob "implicit", resetPasswordForEmail não
 * grava nenhum code_verifier em lugar nenhum: o link do e-mail traz a
 * sessão embutida direto no fragmento da URL (#access_token=...), que
 * qualquer navegador consegue usar sozinho, sem precisar de nenhum estado
 * salvo previamente. O fallback pra esse formato já existe e já foi testado
 * em app/redefinir-senha/reset-password-form.tsx (useSessionBridge).
 */
export function createResetEmailClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } },
  )
}
