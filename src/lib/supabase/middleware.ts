// Helper usado pelo middleware.ts da raiz para renovar o token de sessão do
// Supabase a cada request e decidir redirecionamentos por autenticação/perfil.
// Separado do middleware.ts principal para manter a lógica de
// autorização (canAccessRoute) legível e testável isoladamente.

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database.types"
import { canAccessRoute } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha", "/auth/confirm"]

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

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
      .select("role, status")
      .eq("id", user.id)
      .single()

    if (!profile || profile.status !== "ativo") {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL("/login?erro=conta_inativa", request.url))
    }

    if (!canAccessRoute(profile.role as UserRole, pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return response
}
