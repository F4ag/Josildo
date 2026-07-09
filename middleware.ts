import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Roda em tudo, exceto assets estáticos e arquivos de imagem/ícone do
    // PWA. "brand/" foi adicionado na Etapa 8 (logo) — sem isso, a tag
    // <img src="/brand/logo-lockup.svg"> da própria tela de login era
    // redirecionada pro login (usuário deslogado + rota não-pública), então
    // a logo nunca carregava justo em quem mais precisa vê-la. "sw.js" e
    // "workbox-*.js" são gerados pelo next-pwa em build (next.config.js).
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|brand/|sw.js|workbox-).*)",
  ],
}
