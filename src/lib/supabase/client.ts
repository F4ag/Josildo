// Cliente Supabase para uso em Client Components ("use client").
// Nunca importar este arquivo de dentro de um Server Component/Action —
// use src/lib/supabase/server.ts nesses casos.

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { resolveCookieDomain } from "@/lib/supabase/cookie-domain"

// Mesmo motivo do cast em lib/supabase/server.ts: @supabase/ssr e
// @supabase/supabase-js resolvem o tipo padrão do schema de formas
// incompatíveis entre si em alguns combos de versão, o que quebra o build.
export function createClient(): SupabaseClient<Database, "public", any> {
  // Mesma lógica de lib/supabase/middleware.ts e server.ts: compartilhar o
  // cookie de sessão entre raiz e subdomínios de cliente. Aqui rodando no
  // navegador, então usa window.location.hostname em vez de um header de
  // request. Ver lib/supabase/cookie-domain.ts.
  const cookieDomain =
    typeof window !== "undefined" ? resolveCookieDomain(window.location.hostname) : undefined

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    cookieDomain ? { cookieOptions: { domain: cookieDomain } } : undefined,
  )
}
