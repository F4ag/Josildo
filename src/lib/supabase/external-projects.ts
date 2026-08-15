import "server-only"
import { createClient as createExternalClient } from "@supabase/supabase-js"

// Clients para os outros 3 projetos Supabase do ecossistema (Cadastro Mestre,
// Bússola, Origem) — usados SÓ pela Central de Estratégia
// (app/(app)/central-estrategia), a única tela do Lidera+ que precisa
// atravessar projeto. Nenhum outro módulo deve importar este arquivo.
//
// Diferente de lib/supabase/admin.ts (que aponta pro PRÓPRIO projeto
// Lidera+), estes clients apontam pra bancos externos — por isso não usam o
// tipo `Database` deste projeto (o schema é de outro banco).
//
// Dashboard NÃO tem client aqui: suas tabelas usam cliente_id do Cadastro
// Mestre direto, mas a leitura em si segue pendente da confirmação de acesso
// (ver observação em services/central-estrategia.ts).

function envOrThrow(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} não configurada. Defina em .env.local (ver .env.example) — ` +
        "necessária para a Central de Estratégia consultar outro projeto do ecossistema.",
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
