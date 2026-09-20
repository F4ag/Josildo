// Central de Estratégia — agrega, por cliente, o estado do ciclo estratégico
// (Cadastro Mestre) com dados operacionais reais dos 4 sistemas do
// ecossistema. Usado só por app/(app)/central-estrategia (is_platform_admin).
//
// Cada bloco de sistema (lidera_mais/bussola/origem/dashboard) é buscado de
// forma independente: se um falhar, os outros continuam — nunca deixamos uma
// falha em UM sistema derrubar a tela inteira dos outros três. Ver
// fetchBlock() abaixo.
//
// IMPORTANTE (achado ao implementar, confirmado contra os bancos reais):
// - Bússola: identificador_externo (integracao_sistema) = organizacoes.id.
//   O alvo do cliente é resolvido via alvos.organization_id — pode não
//   existir ainda (cliente que não iniciou campanha), tratado como bloco
//   vazio, não como erro.
// - Origem: identificador_externo = organizations.id (não brand_projects.id).
//   O projeto de marca é o brand_project mais recente daquela organização —
//   também pode não existir ainda.
// - Dashboard: usa cliente_id do Cadastro Mestre DIRETO nas tabelas
//   (rpas.cliente_id etc.), sem passar por integracao_sistema. O registro de
//   integracao_sistema do Dashboard pode conter lixo (ver Seção 4.5 do doc:
//   já foi encontrado o project ref do Supabase no lugar de um cliente_id
//   para o Ricardo Sousa) — inofensivo aqui porque nunca é usado.

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  createBussolaClient,
  createCadastroMestreClient,
  createDashboardClient,
  createOrigemClient,
} from "@/lib/supabase/external-projects"

export type ClienteResumo = { id: string; nome: string; cidade: string | null; estado: string | null }

export type BlockResult<T> = T | { erro: string }

export type PainelLideraMais = {
  lideres_ativos: number
  lideres_total: number
  apoiadores_total: number
  demandas_abertas: number
  bairros_com_lideranca: number
}

export type PainelBussola = {
  indice_campanha_geral: number | null
  sinais_ultimos_7_dias: number
  alertas_abertos: number
  alertas_criticos: number
  observacao?: string
}

export type PainelOrigem = {
  status: string | null
  brand_score: number | null
  trust_index: number | null
  congruence_index: number | null
}

export type PainelDashboard = {
  rpas_ativas: number
  bairros_ativos: number
  liderancas_atuais: number
  liderancas_meta: number
  apoiadores_atuais: number
  apoiadores_meta: number
}

export type PainelCliente = {
  cliente_id: string
  nome: string
  cidade: string | null
  estado: string | null
  campanha: { nome: string; cargo: string | null; status: string } | null
  ciclo: { nome: string; etapa: string; etapa_ordem: number; entrou_em: string } | null
  lidera_mais: BlockResult<PainelLideraMais> | null
  bussola: BlockResult<PainelBussola> | null
  origem: BlockResult<PainelOrigem> | null
  dashboard: BlockResult<PainelDashboard> | null
  atualizado_em: string
}

/** Roda um bloco e converte qualquer erro em `{ erro }` em vez de derrubar o painel inteiro (Seção 5 do doc). */
async function fetchBlock<T>(label: string, run: () => Promise<T>): Promise<BlockResult<T>> {
  try {
    return await run()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[central-estrategia] falha ao buscar bloco "${label}":`, message)
    return { erro: message }
  }
}

export async function listClientes(): Promise<ClienteResumo[]> {
  const cadastroMestre = createCadastroMestreClient()
  const { data, error } = await cadastroMestre
    .from("cliente")
    .select("id, nome, cidade, estado")
    .eq("ativo", true)
    .order("nome")
  if (error) throw new Error(`Falha ao listar clientes no Cadastro Mestre: ${error.message}`)
  return data ?? []
}

async function fetchCampanhaECiclo(clienteId: string) {
  const cadastroMestre = createCadastroMestreClient()

  const { data: campanha, error: campanhaError } = await cadastroMestre
    .from("campanha")
    .select("id, nome, cargo, ano_eleicao, status")
    .eq("cliente_id", clienteId)
    .maybeSingle()
  if (campanhaError) throw new Error(`Falha ao buscar campanha: ${campanhaError.message}`)
  if (!campanha) return { campanha: null, ciclo: null, integracoes: [] as { sistema: string; identificador_externo: string }[] }

  const { data: cicloEstado, error: cicloError } = await cadastroMestre
    .from("campanha_ciclo")
    .select("entrou_em, ciclo_estrategico(nome), etapa_ciclo:etapa_atual_id(nome, ordem)")
    .eq("campanha_id", campanha.id)
    .maybeSingle()
  if (cicloError) throw new Error(`Falha ao buscar ciclo estratégico: ${cicloError.message}`)

  const { data: integracoes, error: integracoesError } = await cadastroMestre
    .from("integracao_sistema")
    .select("sistema, identificador_externo")
    .eq("cliente_id", clienteId)
  if (integracoesError) throw new Error(`Falha ao buscar integrações: ${integracoesError.message}`)

  // Supabase embute ciclo_estrategico/etapa_ciclo como objeto único aqui
  // porque as FKs (ciclo_estrategico_id, etapa_atual_id) não são arrays —
  // cast explícito porque o client sem `Database` tipado não sabe disso.
  const cicloRow = cicloEstado as unknown as
    | { entrou_em: string; ciclo_estrategico: { nome: string } | null; etapa_ciclo: { nome: string; ordem: number } | null }
    | null

  const ciclo =
    cicloRow?.ciclo_estrategico && cicloRow.etapa_ciclo
      ? {
          nome: cicloRow.ciclo_estrategico.nome,
          etapa: cicloRow.etapa_ciclo.nome,
          etapa_ordem: cicloRow.etapa_ciclo.ordem,
          entrou_em: cicloRow.entrou_em,
        }
      : null

  return {
    campanha: { nome: campanha.nome, cargo: campanha.cargo, status: campanha.status },
    ciclo,
    integracoes: integracoes ?? [],
  }
}

async function fetchLideraMais(organizationId: string): Promise<PainelLideraMais> {
  const admin = createAdminClient()

  const [ativos, total, apoiadores, demandas, comBairro] = await Promise.all([
    admin.from("leaders").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "ativa"),
    admin.from("leaders").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    admin.from("supporters").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    admin
      .from("demands")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("status", "in", "(resolvida,cancelada,recusada)"),
    admin.from("leaders").select("neighborhood_id").eq("organization_id", organizationId).not("neighborhood_id", "is", null),
  ])

  for (const [label, result] of [
    ["líderes ativos", ativos], ["líderes total", total], ["apoiadores", apoiadores], ["demandas abertas", demandas],
  ] as const) {
    if (result.error) throw new Error(`Lidera+ (${label}): ${result.error.message}`)
  }
  if (comBairro.error) throw new Error(`Lidera+ (bairros com liderança): ${comBairro.error.message}`)

  const bairrosComLideranca = new Set((comBairro.data ?? []).map((r) => r.neighborhood_id)).size

  return {
    lideres_ativos: ativos.count ?? 0,
    lideres_total: total.count ?? 0,
    apoiadores_total: apoiadores.count ?? 0,
    demandas_abertas: demandas.count ?? 0,
    bairros_com_lideranca: bairrosComLideranca,
  }
}

async function fetchBussola(organizationId: string): Promise<PainelBussola> {
  const bussola = createBussolaClient()

  const { data: alvo, error: alvoError } = await bussola
    .from("alvos")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (alvoError) throw new Error(`Bússola (alvo): ${alvoError.message}`)

  if (!alvo) {
    return {
      indice_campanha_geral: null,
      sinais_ultimos_7_dias: 0,
      alertas_abertos: 0,
      alertas_criticos: 0,
      observacao: "Nenhum alvo configurado ainda para este cliente no Bússola.",
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [indice, sinais, alertasAbertos, alertasCriticos] = await Promise.all([
    bussola
      .from("indice_campanha")
      .select("valor")
      .eq("alvo_id", alvo.id)
      .is("bairro_id", null)
      .order("data_referencia", { ascending: false })
      .limit(1)
      .maybeSingle(),
    bussola.from("sinais").select("id", { count: "exact", head: true }).eq("alvo_id", alvo.id).gt("capturado_em", sevenDaysAgo),
    bussola.from("alertas").select("id", { count: "exact", head: true }).eq("alvo_id", alvo.id).eq("status", "aberto"),
    bussola
      .from("alertas")
      .select("id", { count: "exact", head: true })
      .eq("alvo_id", alvo.id)
      .eq("status", "aberto")
      .eq("severidade", "critico"),
  ])

  if (indice.error) throw new Error(`Bússola (índice): ${indice.error.message}`)
  if (sinais.error) throw new Error(`Bússola (sinais): ${sinais.error.message}`)
  if (alertasAbertos.error) throw new Error(`Bússola (alertas abertos): ${alertasAbertos.error.message}`)
  if (alertasCriticos.error) throw new Error(`Bússola (alertas críticos): ${alertasCriticos.error.message}`)

  return {
    indice_campanha_geral: indice.data?.valor ?? null,
    sinais_ultimos_7_dias: sinais.count ?? 0,
    alertas_abertos: alertasAbertos.count ?? 0,
    alertas_criticos: alertasCriticos.count ?? 0,
  }
}

async function fetchOrigem(organizationId: string): Promise<PainelOrigem> {
  const origem = createOrigemClient()

  const { data: project, error } = await origem
    .from("brand_projects")
    .select("status, brand_score, trust_index, congruence_index")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Origem (brand_project): ${error.message}`)

  if (!project) {
    return { status: null, brand_score: null, trust_index: null, congruence_index: null }
  }
  return project
}

async function fetchDashboard(clienteId: string): Promise<PainelDashboard> {
  const dashboard = createDashboardClient()

  const { data: rpas, error: rpasError } = await dashboard
    .from("rpas")
    .select("id, meta_ativa")
    .eq("cliente_id", clienteId)
  if (rpasError) throw new Error(`Dashboard (rpas): ${rpasError.message}`)

  const rpaIds = (rpas ?? []).map((r) => r.id)
  const rpasAtivas = (rpas ?? []).filter((r) => r.meta_ativa).length

  if (rpaIds.length === 0) {
    return { rpas_ativas: 0, bairros_ativos: 0, liderancas_atuais: 0, liderancas_meta: 0, apoiadores_atuais: 0, apoiadores_meta: 0 }
  }

  const { data: bairros, error: bairrosError } = await dashboard
    .from("bairros")
    .select("id, ativo")
    .in("rpa_id", rpaIds)
  if (bairrosError) throw new Error(`Dashboard (bairros): ${bairrosError.message}`)

  const bairroIds = (bairros ?? []).map((b) => b.id)
  const bairrosAtivos = (bairros ?? []).filter((b) => b.ativo).length

  if (bairroIds.length === 0) {
    return { rpas_ativas: rpasAtivas, bairros_ativos: 0, liderancas_atuais: 0, liderancas_meta: 0, apoiadores_atuais: 0, apoiadores_meta: 0 }
  }

  const [resultados, metas] = await Promise.all([
    dashboard.from("resultados_bairro").select("liderancas, apoiadores").in("bairro_id", bairroIds),
    dashboard.from("metas_bairro").select("meta_liderancas, meta_apoiadores").in("bairro_id", bairroIds),
  ])
  if (resultados.error) throw new Error(`Dashboard (resultados_bairro): ${resultados.error.message}`)
  if (metas.error) throw new Error(`Dashboard (metas_bairro): ${metas.error.message}`)

  const sum = (rows: { [k: string]: number | null }[] | null, key: string) =>
    (rows ?? []).reduce((acc, r) => acc + (r[key] ?? 0), 0)

  return {
    rpas_ativas: rpasAtivas,
    bairros_ativos: bairrosAtivos,
    liderancas_atuais: sum(resultados.data, "liderancas"),
    liderancas_meta: sum(metas.data, "meta_liderancas"),
    apoiadores_atuais: sum(resultados.data, "apoiadores"),
    apoiadores_meta: sum(metas.data, "meta_apoiadores"),
  }
}

export async function getPainelCliente(clienteId: string): Promise<PainelCliente> {
  const cadastroMestre = createCadastroMestreClient()

  const { data: cliente, error: clienteError } = await cadastroMestre
    .from("cliente")
    .select("id, nome, cidade, estado")
    .eq("id", clienteId)
    .single()
  if (clienteError) throw new Error(`Cliente não encontrado no Cadastro Mestre: ${clienteError.message}`)

  const { campanha, ciclo, integracoes } = await fetchCampanhaECiclo(clienteId)

  const orgIdFor = (sistema: string) => integracoes.find((i) => i.sistema === sistema)?.identificador_externo ?? null

  const lideraMaisOrgId = orgIdFor("lidera_mais")
  const bussolaOrgId = orgIdFor("bussola")
  const origemOrgId = orgIdFor("origem")

  const [lideraMais, bussola, origem, dashboard] = await Promise.all([
    lideraMaisOrgId
      ? fetchBlock("lidera_mais", () => fetchLideraMais(lideraMaisOrgId))
      : Promise.resolve({ erro: "Sem integração lidera_mais cadastrada para este cliente." } as const),
    bussolaOrgId
      ? fetchBlock("bussola", () => fetchBussola(bussolaOrgId))
      : Promise.resolve({ erro: "Sem integração bussola cadastrada para este cliente." } as const),
    origemOrgId
      ? fetchBlock("origem", () => fetchOrigem(origemOrgId))
      : Promise.resolve({ erro: "Sem integração origem cadastrada para este cliente." } as const),
    fetchBlock("dashboard", () => fetchDashboard(clienteId)),
  ])

  return {
    cliente_id: cliente.id,
    nome: cliente.nome,
    cidade: cliente.cidade,
    estado: cliente.estado,
    campanha,
    ciclo,
    lidera_mais: lideraMais,
    bussola,
    origem,
    dashboard,
    atualizado_em: new Date().toISOString(),
  }
}
