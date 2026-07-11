// Helper usado pelo middleware.ts da raiz para renovar o token de sessão do
// Supabase a cada request e decidir redirecionamentos por autenticação/perfil
// e, desde a migração multi-tenant (docs/07-migracao-multi-tenant.md), por
// organização/subdomínio. Separado do middleware.ts principal para manter a
// lógica de autorização (canAccessRoute) legível e testável isoladamente.

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database.types"
import { canAccessRoute } from "@/lib/permissions"
import { resolveCookieDomain } from "@/lib/supabase/cookie-domain"
import type { UserRole } from "@/types/domain"

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha", "/auth/confirm"]

// Domínio raiz do produto. A organização do cliente atual (Lidera+) atende
// pelo próprio domínio raiz, sem subdomínio — para não quebrar nenhum
// favorito/QR code/instalação de PWA já em uso. Clientes novos ganham um
// subdomínio (slug.lideramais.app.br). Configurável via env pra funcionar
// igual em outro domínio raiz (ex.: ambiente de teste).
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lideramais.app.br"
const DEFAULT_ORG_SLUG = "lidera-mais"

/**
 * Resolve qual organização (por slug) corresponde ao host da request atual.
 * Não bate no banco — é só parsing de string. A validação de que o slug
 * realmente existe (e pertence ao usuário logado) acontece depois, via RLS.
 */
function resolveTenantSlug(host: string | null): string {
  if (!host) return DEFAULT_ORG_SLUG
  const hostname = (host.split(":")[0] ?? host).toLowerCase()

  // Ambiente local e preview da Vercel não têm subdomínio de cliente —
  // sempre tratados como a organização padrão.
  if (hostname === "localhost" || hostname.endsWith(".vercel.app")) {
    return DEFAULT_ORG_SLUG
  }

  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return DEFAULT_ORG_SLUG
  }

  const suffix = `.${ROOT_DOMAIN}`
  if (hostname.endsWith(suffix)) {
    return hostname.slice(0, -suffix.length)
  }

  // Host fora do domínio raiz conhecido (não deveria acontecer se DNS/Vercel
  // só apontam pra lideramais.app.br e subdomínios) — cai no padrão em vez
  // de quebrar a navegação.
  return DEFAULT_ORG_SLUG
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Cast igual ao de lib/supabase/server.ts: @supabase/ssr e
  // @supabase/supabase-js resolvem o tipo padrão do schema de formas
  // incompatíveis entre si em alguns combos de versão (aqui já causou
  // "propriedade não existe no tipo 'never'" na consulta de profile abaixo).
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Mesmo motivo do "cache: no-store" em lib/supabase/server.ts: sem
      // isso, o fetch global do Next.js pode reaproveitar a resposta de uma
      // requisição anterior (de outro usuário/organização) pra essa mesma
      // URL do PostgREST — o cache por padrão não leva o header
      // Authorization em conta. No middleware isso é ainda mais crítico:
      // é exatamente a consulta que decide se o usuário fica no
      // subdomínio certo.
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          // Domain=.lideramais.app.br faz o cookie de sessão valer tanto na
          // raiz quanto em qualquer subdomínio de cliente — sem isso, trocar
          // de host (ver redirect de tenant mais abaixo) derruba a sessão.
          // Ver comentário completo em lib/supabase/cookie-domain.ts.
          const cookieDomain = resolveCookieDomain(request.headers.get("host"))
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, cookieDomain ? { ...options, domain: cookieDomain } : options)
          }
        },
      },
    },
  ) as SupabaseClient<Database, "public", any>

  // IMPORTANTE: não remover este getUser(). Ele é o que efetivamente
  // renova o token — sem essa chamada a sessão expira silenciosamente.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from("users_profiles")
      .select("role, status, is_platform_admin")
      .eq("id", user.id)
      .single()

    if (!profile || profile.status !== "ativo") {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL("/login?erro=conta_inativa", request.url))
    }

    if (!canAccessRoute(profile.role as UserRole, pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // /clientes é o painel cross-tenant de provisionamento (só Agência F4,
    // is_platform_admin) — não é sobre role, então fica fora de
    // canAccessRoute/ADMIN_GERAL_ONLY_ROUTE_PREFIXES (ver lib/permissions.ts).
    if (pathname.startsWith("/clientes") && !profile.is_platform_admin) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // ------------------------------------------------------------------
    // Multi-tenant: confere se o subdomínio atual é o da própria
    // organização do usuário. A policy "org_select_own" já restringe
    // "select * from organizations" a UMA linha só (a do usuário logado,
    // por RLS) — então basta comparar o slug dela com o slug do host.
    // Isso NÃO é a barreira de segurança (essa é a RLS em cada tabela de
    // dado, que já isola por organization_id independente de qual
    // subdomínio serviu a request) — é só pra evitar o usuário ficar
    // logado com a marca/URL de outro cliente na tela.
    // ------------------------------------------------------------------
    const tenantSlug = resolveTenantSlug(request.headers.get("host"))
    const { data: myOrg } = await supabase.from("organizations").select("slug").maybeSingle()

    if (myOrg && myOrg.slug !== tenantSlug) {
      const correctHost =
        myOrg.slug === DEFAULT_ORG_SLUG ? ROOT_DOMAIN : `${myOrg.slug}.${ROOT_DOMAIN}`
      const redirectUrl = new URL(request.url)
      redirectUrl.hostname = correctHost
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
}
