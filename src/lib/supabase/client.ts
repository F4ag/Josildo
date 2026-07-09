// Cliente Supabase para uso em Client Components ("use client").
// Nunca importar este arquivo de dentro de um Server Component/Action —
// use src/lib/supabase/server.ts nesses casos.

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

// Mesmo motivo do cast em lib/supabase/server.ts: @supabase/ssr e
// @supabase/supabase-js resolvem o tipo padrão do schema de formas
// incompatíveis entre si em alguns combos de versão, o que quebra o build.
export function createClient(): SupabaseClient<Database, "public", any> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
