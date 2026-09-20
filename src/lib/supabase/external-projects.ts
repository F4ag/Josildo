import "server-only"
import { createClient as createExternalClient } from "@supabase/supabase-js"

// Clients para os outros 3 projetos Supabase do ecossistema (Cadastro Mestre,
// Bússola, Origem) e para o Dashboard — usados pela Central de Estratégia
// (app/(app)/central-estrategia) e também pelo pipeline de provisionamento
// cross-sistema (app/(app)/clientes/novo, app/(app)/configuracoes/eleicao, e
// a action de retry em app/(app)/clientes/actions.ts), que precisam atravessar
// projeto para criar/consultar dados nesses outros sistemas.
//
// Diferente de lib/supabase/admin.ts (que aponta pro PRÓPRIO projeto
// Lidera+), estes clients apontam pra bancos externos — por isso não usam o
// tipo `Database` deste projeto (o schema é de outro banco).

function envOrThrow(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} não configurada. Defina em .env.local (ver .env.example) — ` +
        "necessária para funcionalidades que consultam outros projetos do ecossistema " +
        "(Central de Estratégia, provisionamento de clientes).",
    )
  }
  return value
}

export function createCadastroMestreClient() {
  return createExternalClient(envOrThrow("CADASTRO_MESTRE_URL"), envOrThrow("CADASTRO_MESTRE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createBussolaClient() {
  return createExternalClient(envOrThrow("BUSSOLA_URL"), envOrThrow("BUSSOLA_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createOrigemClient() {
  return createExternalClient(envOrThrow("ORIGEM_URL"), envOrThrow("ORIGEM_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createDashboardClient() {
  return createExternalClient(envOrThrow("DASHBOARD_URL"), envOrThrow("DASHBOARD_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
