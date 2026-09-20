import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import {
  getPainelCliente,
  listClientes,
  type BlockResult,
  type PainelCliente,
} from "@/services/central-estrategia"

export const metadata: Metadata = { title: "Central de Estratégia · Lidera+" }

// Painel busca ao vivo a cada carregamento, de propósito (Seção 9 do doc:
// "cache ou persistência dos dados agregados" está fora de escopo) — não
// cachear em nenhuma camada.
export const dynamic = "force-dynamic"

const ORDERED_ETAPAS = ["Pré-campanha", "Estruturação Territorial", "Convenção", "Campanha Oficial", "Reta Final"]

export default async function CentralEstrategiaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const session = await getSessionUser()
  // Visão de agência sobre todos os clientes — nunca sobre role de cliente
  // (ver comentário em app/(app)/clientes/page.tsx, mesmo padrão aqui).
  if (!session?.profile.is_platform_admin) notFound()

  const { cliente: clienteId } = await searchParams
  const clientes = await listClientes()
  const painel = clienteId ? await getPainelCliente(clienteId) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Central de Estratégia</h1>
          <p className="text-sm text-foreground/60">
            Estado do ciclo estratégico e dados operacionais dos 4 sistemas, por cliente.
          </p>
        </div>
        {painel && (
          <Link
            href={`/central-estrategia?cliente=${clienteId}`}
            className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5"
          >
            Atualizar
          </Link>
        )}
      </div>

      <div className="rounded-lg border border-black/5 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-foreground/70">Cliente</p>
        <div className="flex flex-wrap gap-2">
          {clientes.map((c) => (
            <Link
              key={c.id}
              href={`/central-estrategia?cliente=${c.id}`}
              className={
                "rounded-md border px-3 py-1.5 text-sm font-medium " +
                (c.id === clienteId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-black/10 hover:bg-black/5")
              }
            >
              {c.nome}
              {c.cidade && <span className="ml-1 text-xs opacity-70">· {c.cidade}</span>}
            </Link>
          ))}
        </div>
      </div>

      {!painel && (
        <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
          Selecione um cliente para ver o painel.
        </div>
      )}

      {painel && <PainelClienteView painel={painel} />}
    </div>
  )
}

function PainelClienteView({ painel }: { painel: PainelCliente }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-black/5 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{painel.nome}</h2>
            <p className="text-sm text-foreground/60">
              {[painel.cidade, painel.estado].filter(Boolean).join(" / ") || "—"}
            </p>
          </div>
          {painel.campanha && (
            <div className="text-right text-sm">
              <p className="font-medium text-foreground">{painel.campanha.nome}</p>
              <p className="text-foreground/60">
                {painel.campanha.cargo ?? "—"} ·{" "}
                <Badge tone={painel.campanha.status === "ativa" ? "verde" : "cinza"}>{painel.campanha.status}</Badge>
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-black/5 pt-4">
          {painel.ciclo ? (
            <EtapaStepper cicloNome={painel.ciclo.nome} etapaAtual={painel.ciclo.etapa} entrouEm={painel.ciclo.entrou_em} />
          ) : (
            <p className="text-sm text-foreground/50">Sem ciclo estratégico atribuído ainda.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SistemaCard titulo="Lidera+" resultado={painel.lidera_mais}>
          {(d) => (
            <>
              <Metrica label="Líderes ativos" valor={d.lideres_ativos} />
              <Metrica label="Líderes (total)" valor={d.lideres_total} />
              <Metrica label="Apoiadores" valor={d.apoiadores_total} />
              <Metrica label="Demandas abertas" valor={d.demandas_abertas} />
              <Metrica label="Bairros com liderança" valor={d.bairros_com_lideranca} />
            </>
          )}
        </SistemaCard>

        <SistemaCard titulo="Bússola" resultado={painel.bussola}>
          {(d) => (
            <>
              {d.observacao && <p className="mb-2 text-xs text-foreground/50">{d.observacao}</p>}
              <Metrica label="Índice de campanha" valor={d.indice_campanha_geral ?? "—"} />
              <Metrica label="Sinais (7 dias)" valor={d.sinais_ultimos_7_dias} />
              <Metrica label="Alertas abertos" valor={d.alertas_abertos} />
              <Metrica label="Alertas críticos" valor={d.alertas_criticos} tone={d.alertas_criticos > 0 ? "vermelho" : undefined} />
            </>
          )}
        </SistemaCard>

        <SistemaCard titulo="Origem" resultado={painel.origem}>
          {(d) => (
            <>
              <Metrica label="Status" valor={d.status ?? "—"} />
              <Metrica label="Brand score" valor={d.brand_score ?? "—"} />
              <Metrica label="Trust index" valor={d.trust_index ?? "—"} />
              <Metrica label="Congruence index" valor={d.congruence_index ?? "—"} />
            </>
          )}
        </SistemaCard>

        <SistemaCard titulo="Dashboard" resultado={painel.dashboard}>
          {(d) => (
            <>
              <Metrica label="RPAs ativas" valor={d.rpas_ativas} />
              <Metrica label="Bairros ativos" valor={d.bairros_ativos} />
              <Metrica label="Lideranças" valor={`${d.liderancas_atuais} / ${d.liderancas_meta}`} />
              <Metrica label="Apoiadores" valor={`${d.apoiadores_atuais} / ${d.apoiadores_meta}`} />
            </>
          )}
        </SistemaCard>
      </div>

      <p className="text-right text-xs text-foreground/40">
        Atualizado em {new Date(painel.atualizado_em).toLocaleString("pt-BR")}
      </p>
    </div>
  )
}

function EtapaStepper({ cicloNome, etapaAtual, entrouEm }: { cicloNome: string; etapaAtual: string; entrouEm: string }) {
  // ORDERED_ETAPAS é a ordem do ciclo padrão semeado no Cadastro Mestre. Um
  // ciclo customizado pode ter etapas com outros nomes — nesse caso o
  // stepper cai de volta pra só listar etapaAtual em destaque (sem quebrar).
  const currentIndex = ORDERED_ETAPAS.indexOf(etapaAtual)

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase text-foreground/50">{cicloNome}</p>
      {currentIndex === -1 ? (
        <Badge tone="azul">{etapaAtual}</Badge>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {ORDERED_ETAPAS.map((etapa, i) => (
            <div key={etapa} className="flex items-center gap-2">
              <span
                className={
                  "rounded-full px-3 py-1 text-xs font-medium " +
                  (i === currentIndex
                    ? "bg-primary text-primary-foreground"
                    : i < currentIndex
                      ? "bg-secondary/10 text-secondary"
                      : "bg-black/5 text-foreground/50")
                }
              >
                {etapa}
              </span>
              {i < ORDERED_ETAPAS.length - 1 && <span className="text-foreground/20">→</span>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-foreground/50">
        Nesta etapa desde {new Date(entrouEm).toLocaleDateString("pt-BR")}
      </p>
    </div>
  )
}

function SistemaCard<T extends object>({
  titulo,
  resultado,
  children,
}: {
  titulo: string
  resultado: BlockResult<T> | null
  children: (data: T) => React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-black/5 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">{titulo}</p>
      {!resultado ? (
        <p className="text-sm text-foreground/40">Sem dados.</p>
      ) : "erro" in resultado ? (
        <p className="text-sm text-status-atrasada">Não foi possível carregar: {resultado.erro}</p>
      ) : (
        <div className="space-y-1.5">{children(resultado)}</div>
      )}
    </div>
  )
}

function Metrica({
  label,
  valor,
  tone,
}: {
  label: string
  valor: string | number
  tone?: "vermelho"
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className={"font-medium " + (tone === "vermelho" ? "text-status-atrasada" : "text-foreground")}>{valor}</span>
    </div>
  )
}
