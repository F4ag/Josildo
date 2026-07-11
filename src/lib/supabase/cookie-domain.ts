// Helper compartilhado por client.ts, server.ts e middleware.ts.
//
// Sem isso, o cookie de sessão do Supabase fica "host-only": criado em
// lideramais.app.br, o navegador nunca manda esse cookie pra
// flux45.lideramais.app.br (e vice-versa) — são origens diferentes pro
// navegador, mesmo sendo o mesmo produto. Resultado observado: um usuário
// como flux45g@gmail.com conseguia logar tanto pela raiz quanto pelo próprio
// subdomínio, como duas sessões independentes, e o redirect de tenant do
// middleware (ver middleware.ts) "derrubava" a sessão ao trocar de host em
// vez de simplesmente corrigir a URL.
//
// A correção é gravar o cookie com Domain=.lideramais.app.br (o ponto na
// frente é o que faz o navegador compartilhar entre raiz E subdomínios).
// Só faz isso quando o host da request bate com o domínio raiz configurado
// — em localhost ou *.vercel.app (preview), um Domain assim seria inválido/
// silenciosamente ignorado pelo navegador, então ali é melhor nem mandar
// (cookie host-only padrão, que já funciona nesses ambientes).

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lideramais.app.br"

export function resolveCookieDomain(host: string | null | undefined): string | undefined {
  if (!host) return undefined
  const hostname = host.split(":")[0]?.toLowerCase()
  if (!hostname) return undefined

  if (hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return `.${ROOT_DOMAIN}`
  }

  return undefined
}
