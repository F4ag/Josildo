import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getVoteComparisonSummary, getVoteComparisonByPollingLocation } from "@/services/reports"
import { listDistinctLeaderCities, listDistinctLeaderNeighborhoods } from "@/services/leaders"
import { ELECTION_CARGO_LABELS, type ELECTION_CARGOS } from "@/lib/validations/election"
import { PrintButton } from "@/components/print-button"
import { PrintLogo } from "@/components/print-logo"
import { VoteComparisonChart } from "@/components/dashboard/vote-comparison-chart"

export const metadata: Metadata = { title: "Comparativo de votos · Lidera+" }

type SearchParams = { cidade?: string; bairro?: string; turno?: string }
type ElectionCargo = (typeof ELECTION_CARGOS)[number]

// Aberto aos três perfis (diferente de /relatorios/votos, que é adminOnly) —
// só usa expected_votes (o que a própria liderança informou), nunca
// admin_estimated_votes. Ver nota em services/reports.ts.
export default async function ComparativoVotosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const params = await searchParams
  const turno = params.turno === "2" ? 2 : 1
  const supabase = await createClient()

  const { data: org } = await supabase
    .from("organizations")
    .select("election_year, election_cargo, election_candidate_number")
    .eq("id", session.profile.organization_id)
    .single()

  const electionConfigured = Boolean(org?.election_year && org?.election_cargo && org?.election_candidate_number)

  const [summary, byPollingLocation, cities, neighborhoods] = await Promise.all([
    getVoteComparisonSummary(supabase, { turno }),
    getVoteComparisonByPollingLocation(supabase, { city: params.cidade, neighborhood: params.bairro, turno }),
    listDistinctLeaderCities(supabase),
    listDistinctLeaderNeighborhoods(supabase, { city: params.cidade }),
  ])

  const diffTotal = summary.totalExpectedVotes > 0
    ? Math.round(((summary.totalRealVotes - summary.totalExpectedVotes) / summary.totalExpectedVotes) * 1000) / 10
    : null

  return (
    <div className="space-y-6">
      <PrintLogo />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Comparativo de votos</h1>
          <p className="text-sm text-foreground/60">
            Expectativa informada pelas lideranças x resultado real da votação, seção por seção, direto do TSE.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <PrintButton />
        </div>
      </div>

      {!electionConfigured ? (
        <div className="rounded-xl border border-black/10 bg-black/[0.02] p-6 text-sm text-foreground/70">
          A eleição ainda não foi configurada para este cliente.{" "}
          {session.profile.role === "admin_geral" ? (
            <>
              Preencha o cargo, o número do candidato e o ano em{" "}
              <Link href="/configuracoes/eleicao" className="text-secondary hover:underline">Configurações &gt; Eleição</Link>{" "}
              para habilitar este relatório.
            </>
          ) : (
            "Peça ao Admin Geral para configurar o candidato em Configurações."
          )}
        </div>
      ) : !summary.hasResults ? (
        <div className="rounded-xl border border-black/10 bg-black/[0.02] p-6 text-sm text-foreground/70">
          Candidato configurado — {ELECTION_CARGO_LABELS[org!.election_cargo as ElectionCargo]}, nº{" "}
          {org!.election_candidate_number}, eleição {org!.election_year}. Ainda não há resultado real importado (só
          fica disponível depois da apuração, e a importação é automática). Por enquanto, os números abaixo mostram
          só a expectativa informada.
        </div>
      ) : (
        <p className="text-xs text-foreground/50">
          Último resultado importado do TSE em{" "}
          {summary.lastImportedAt ? new Date(summary.lastImportedAt).toLocaleString("pt-BR") : "—"}.
        </p>
      )}

      <div className="no-print flex items-center gap-2">
        <Link href={`/relatorios/comparativo-votos?turno=1${params.cidade ? `&cidade=${params.cidade}` : ""}${params.bairro ? `&bairro=${params.bairro}` : ""}`}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${turno === 1 ? "bg-primary text-primary-foreground" : "bg-black/5 text-foreground/70"}`}>
          1º turno
        </Link>
        <Link href={`/relatorios/comparativo-votos?turno=2${params.cidade ? `&cidade=${params.cidade}` : ""}${params.bairro ? `&bairro=${params.bairro}` : ""}`}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${turno === 2 ? "bg-primary text-primary-foreground" : "bg-black/5 text-foreground/70"}`}>
          2º turno
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
          <p className="text-xs uppercase text-foreground/50">Esperado (lideranças)</p>
          <p className="text-2xl font-semibold text-primary">{summary.totalExpectedVotes}</p>
        </div>
        <div className="rounded-lg border border-secondary/20 bg-secondary/5 p-4">
          <p className="text-xs uppercase text-foreground/50">Resultado real (TSE)</p>
          <p className="text-2xl font-semibold text-secondary">{summary.totalRealVotes}</p>
        </div>
        <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
          <p className="text-xs uppercase text-foreground/50">Diferença</p>
          <p className="text-2xl font-semibold text-accent">{diffTotal != null ? `${diffTotal > 0 ? "+" : ""}${diffTotal}%` : "—"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Por local de votação</p>
          <form className="no-print flex flex-wrap gap-2">
            <input type="hidden" name="turno" value={turno} />
            <select name="cidade" defaultValue={params.cidade ?? ""}
              className="rounded-md border border-black/10 px-3 py-2 text-sm">
              <option value="">Todas as cidades</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select name="bairro" defaultValue={params.bairro ?? ""}
              className="rounded-md border border-black/10 px-3 py-2 text-sm">
              <option value="">Todos os bairros</option>
              {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Filtrar
            </button>
          </form>
        </div>

        <div className="mb-4 rounded-lg border border-black/5 bg-white p-4">
          <VoteComparisonChart data={byPollingLocation} emptyMessage="Nenhuma liderança com local de votação cadastrado ainda." />
        </div>

        <div className="no-print grid gap-3 sm:hidden">
          {byPollingLocation.map((row) => (
            <div key={row.id} className="rounded-lg border border-black/5 bg-white p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{row.label}</p>
                <span className="text-xs text-foreground/60">{row.city ?? "—"}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
                <span>Esperado: {row.expectedVotes}</span>
                <span>Real: {row.realVotes}</span>
                <span className="col-span-2">Diferença: {row.diffPct != null ? `${row.diffPct > 0 ? "+" : ""}${row.diffPct}%` : "—"}</span>
              </div>
            </div>
          ))}
          {byPollingLocation.length === 0 && (
            <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
              Nenhuma liderança com local de votação cadastrado ainda.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
              <tr>
                <th className="px-4 py-3">Local de votação</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3 text-center">Esperado</th>
                <th className="px-4 py-3 text-center">Resultado real</th>
                <th className="px-4 py-3 text-center">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {byPollingLocation.map((row) => (
                <tr key={row.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-foreground/70">{row.city ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{row.expectedVotes}</td>
                  <td className="px-4 py-3 text-center">{row.realVotes}</td>
                  <td className="px-4 py-3 text-center">
                    {row.diffPct != null ? `${row.diffPct > 0 ? "+" : ""}${row.diffPct}%` : "—"}
                  </td>
                </tr>
              ))}
              {byPollingLocation.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">
                    Nenhuma liderança com local de votação cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
