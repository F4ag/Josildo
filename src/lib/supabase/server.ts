// Cliente Supabase para uso em Server Components, Server Actions e Route
// Handlers. Lê/escreve cookies de sessão via `next/headers` — por isso não
// pode ser importado num Client Component.

import { cookies, headers } from "next/headers"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { resolveCookieDomain } from "@/lib/supabase/cookie-domain"

// O retorno é forçado para SupabaseClient<Database, "public", any> (em vez de
// deixar o TypeScript inferir sozinho): @supabase/ssr e @supabase/supabase-js
// às vezes resolvem o tipo padrão do schema de formas incompatíveis entre si,
// o que já quebrou o build de produção (erro "não pode ser atribuído ao tipo
// 'public'" / propriedades somem virando "never"). Fixar aqui, na única
// função que cria o client do lado do servidor, resolve para todo mundo que
// usa createClient() — não só quem passa pelos services/*.ts.
export async function createClient(): Promise<SupabaseClient<Database, "public", any>> {
  const cookieStore = await cookies()
  // Mesma lógica de lib/supabase/middleware.ts: compartilhar o cookie de
  // sessão entre raiz e subdomínios de cliente (Domain=.lideramais.app.br).
  // Ver lib/supabase/cookie-domain.ts.
  const cookieDomain = resolveCookieDomain((await headers()).get("host"))

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // O Next.js intercepta o fetch global no servidor e, por padrão,
      // guarda a resposta no Data Cache — inclusive as chamadas que o
      // supabase-js faz por baixo dos panos pra ler o banco. Isso já causou
      // o /mapa mostrar uma foto antiga dos dados depois de uma edição
      // (ver comentário em app/(app)/mapa/page.tsx). "cache: no-store" aqui
      // desliga esse cache pra QUALQUER leitura feita com este client, em
      // qualquer página — não só no mapa — então esse tipo de bug não pode
      // se repetir em outro módulo no futuro.
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, cookieDomain ? { ...options, domain: cookieDomain } : options)
            }
          } catch {
            // `setAll` chamado de um Server Component (não de uma Server
            // Action/Route Handler) não pode escrever cookies. Tudo bem
            // ignorar aqui: o middleware.ts já cuida do refresh de sessão.
          }
        },
      },
    },
  )
}
