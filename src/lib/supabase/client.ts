// Cliente Supabase para uso em Client Components ("use client").
// Nunca importar este arquivo de dentro de um Server Component/Action —
// use src/lib/supabase/server.ts nesses casos.

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database.types"

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
