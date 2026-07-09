import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

/**
 * Cliente Supabase com a service_role key — ignora RLS por completo.
 *
 * USO RESTRITO: só dentro de Server Actions que já checaram
 * `requireSessionUser().profile.role === "admin_geral"` antes de chamar isto
 * (ver src/app/(app)/configuracoes/usuarios/actions.ts). Nunca importar este
 * arquivo de um Client Component — o pacote "server-only" quebra o build se
 * isso acontecer por engano.
 *
 * Necessário para duas operações que a chave pública não pode fazer:
 *   1) auth.admin.inviteUserByEmail / createUser (criar login de outra pessoa)
 *   2) ler/gravar em users_profiles antes de o próprio usuário existir
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Defina em .env.local (ver .env.example) — " +
        "pegue em Project Settings > API > service_role no painel do Supabase.",
    )
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
