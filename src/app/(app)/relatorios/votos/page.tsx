import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Download } from "lucide-react"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getVotesSummary, getVotesByCity, getVotesByNeighborhood, getVotesByPollingLocation } from "@/services/reports"
import { listDistinctLeaderCities, listDistinctLeaderNeighborhoods } from "@/services/leaders"
import type { UserRole } from "@/types/domain"
import { PrintButton } from "@/components/print-button"
import { PrintLogo } from "@/components/print-logo"

export const metadata: Metadata = { title: "Expectativa de votos · Lidera+" }

type SearchParams = { cidade?: string; bairro?: string }

// Relatório restrito a admin_geral (mais restrito que o resto do módulo
// Relatórios, que admin_equipe também acessa) — cruza expected_votes (o que
// a própria liderança diz que entrega) com admin_estimated_votes, campo
// admin-only em todo o resto do sistema (ver liderancas/actions.ts).
export default async function RelatorioVotosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole
  if (!session || role !== "admin_geral") {
    redirect("/relatorios")
  }

  const params = await searchParams
  const supabase = await createClient()
  const [summary, byCity, cities, neighborhoods, byNeighborhood, votesByPollingLocation] = await Promise.all([
    getVotesSummary(supabase),
    getVotesByCity(supabase, { city: params.cidade }),
    listDistinctLeaderCities(supabase),
    listDistinctLeaderNeighborhoods(supabase, { city: params.cidade }),
    getVotesByNeighborhood(supabase, { city: params.cidade, neighborhood: params.bairro }),
    getVotesByPollingLocation(supabase, { city: params.cidade, neighborhood: params.bairro }),
  ])
  const { rows: byPollingLocation, leadersWithoutLocation } = votesByPollingLocation

  const pdfParams = new URLSearchParams()
  if (params.cidade) pdfParams.set("cidade", params.cidade)
  if (params.bairro) pdfParams.set("bairro", params.bairro)
  const pdfQuery = pdfParams.toString()

  // Linha de total no rodapé das duas tabelas — soma dos grupos exibidos
  // (respeita o filtro de cidade em "por bairro", por isso não reaproveita
  // o summary geral, que sempre olha todas as lideranças).
  const totalByCity = byCity.reduce(
    (acc, row) => ({
      leaderCount: acc.leaderCount + row.leaderCount,
      expectedVotes: acc.expectedVotes + row.expectedVotes,
      adminEstimatedVotes: acc.adminEstimatedVotes + row.adminEstimatedVotes,
    }),
    { leaderCount: 0, expectedVotes: 0, adminEstimatedVotes: 0 },
  )
  const totalByNeighborhood = byNeighborhood.reduce(
    (acc, row) => ({
      leaderCount: acc.leaderCount + row.leaderCount,
      expectedVotes: acc.expectedVotes + row.expectedVotes,
      adminEstimatedVotes: acc.adminEstimatedVotes + row.adminEstimatedVotes,
    }),
    { leaderCount: 0, expectedVotes: 0, adminEstimatedVotes: 0 },
  )

  return (
    <div className="space-y-6">
      <PrintLogo />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Expectativa de votos</h1>
          <p className="text-sm text-foreground/60">
            Comparação entre o que cada liderança informa e a sua avaliação como Admin Geral.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link href={`/relatorios/votos/pdf${pdfQuery ? `?${pdfQuery}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Download className="h-4 w-4" aria-hidden />
            Baixar PDF
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
          <p className="text-xs uppercase text-foreground/50">Expectativa Liderança</p>
          <p className="text-2xl font-semibold text-primary">{summary.totalExpectedVotes}</p>
          <p className="mt-1 text-xs text-foreground/50">
            {summary.leadersWithExpectedVotes} de {summary.totalLeaders} lideranças informaram uma expectativa.
          </p>
        </div>
        <div className="rounded-lg border border-secondary/20 bg-secondary/5 p-4">
          <p className="text-xs uppercase text-foreground/50">Expectativa Admin Geral</p>
          <p className="text-2xl font-semibold text-secondary">{summary.totalAdminEstimatedVotes}</p>
          <p className="mt-1 text-xs text-foreground/50">
            {summary.leadersWithAdminEstimate} de {summary.totalLeaders} lideranças já foram avaliadas.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Por cidade</p>
          <form className="no-print flex gap-2">
            <select name="cidade" defaultValue={params.cidade ?? ""}
              className="rounded-md border border-black/10 px-3 py-2 text-sm">
              <option value="">Todas as cidades</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Filtrar
            </button>
          </form>
        </div>

        <div className="no-print grid gap-3 sm:hidden">
          {byCity.map((row) => (
            <div key={row.label} className="rounded-lg border border-black/5 bg-white p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{row.label}</p>
                <span className="text-xs text-foreground/60">{row.leaderCount} liderança(s)</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
                <span>Informado: {row.expectedVotes}</span>
                <span>Avaliação admin: {row.adminEstimatedVotes}</span>
              </div>
            </div>
          ))}
          {byCity.length === 0 && (
            <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
              Nenhuma liderança cadastrada.
            </div>
          )}
          {byCity.length > 0 && (
            <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">Total</p>
                <span className="text-xs text-foreground/60">{totalByCity.leaderCount} liderança(s)</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
                <span>Informado: {totalByCity.expectedVotes}</span>
                <span>Avaliação admin: {totalByCity.adminEstimatedVotes}</span>
              </div>
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
              <tr>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3 text-center">Lideranças</th>
                <th className="px-4 py-3 text-center">Informado (liderança)</th>
                <th className="px-4 py-3 text-center">Avaliação (admin)</th>
              </tr>
            </thead>
            <tbody>
              {byCity.map((row) => (
                <tr key={row.label} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-center">{row.leaderCount}</td>
                  <td className="px-4 py-3 text-center">{row.expectedVotes}</td>
                  <td className="px-4 py-3 text-center">{row.adminEstimatedVotes}</td>
                </tr>
              ))}
              {byCity.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-foreground/50">
                    Nenhuma liderança cadastrada.
                  </td>
                </tr>
              )}
              {byCity.length > 0 && (
                <tr className="border-t border-black/10 bg-black/[0.02] font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-center">{totalByCity.leaderCount}</td>
                  <td className="px-4 py-3 text-center">{totalByCity.expectedVotes}</td>
                  <td className="px-4 py-3 text-center">{totalByCity.adminEstimatedVotes}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Por bairro</p>
          <form className="no-print flex flex-wrap gap-2">
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

        <div className="no-print grid gap-3 sm:hidden">
          {byNeighborhood.map((row) => (
            <div key={`${row.city ?? "sem-cidade"}-${row.label}`} className="rounded-lg border border-black/5 bg-white p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{row.label}</p>
                <span className="text-xs text-foreground/60">{row.leaderCount} liderança(s)</span>
              </div>
              <p className="text-xs text-foreground/50">{row.city ?? "Sem cidade"}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
                <span>Informado: {row.expectedVotes}</span>
                <span>Avaliação admin: {row.adminEstimatedVotes}</span>
              </div>
            </div>
          ))}
          {byNeighborhood.length === 0 && (
            <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
              Nenhuma liderança cadastrada.
            </div>
          )}
          {byNeighborhood.length > 0 && (
            <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">Total</p>
                <span className="text-xs text-foreground/60">{totalByNeighborhood.leaderCount} liderança(s)</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
                <span>Informado: {totalByNeighborhood.expectedVotes}</span>
                <span>Avaliação admin: {totalByNeighborhood.adminEstimatedVotes}</span>
              </div>
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
              <tr>
                <th className="px-4 py-3">Bairro</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3 text-center">Lideranças</th>
                <th className="px-4 py-3 text-center">Informado (liderança)</th>
                <th className="px-4 py-3 text-center">Avaliação (admin)</th>
              </tr>
            </thead>
            <tbody>
              {byNeighborhood.map((row) => (
                <tr key={`${row.city ?? "sem-cidade"}-${row.label}`} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-foreground/70">{row.city ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{row.leaderCount}</td>
                  <td className="px-4 py-3 text-center">{row.expectedVotes}</td>
                  <td className="px-4 py-3 text-center">{row.adminEstimatedVotes}</td>
                </tr>
              ))}
              {byNeighborhood.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">
                    Nenhuma liderança cadastrada.
                  </td>
                </tr>
              )}
              {byNeighborhood.length > 0 && (
                <tr className="border-t border-black/10 bg-black/[0.02] font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-center">{totalByNeighborhood.leaderCount}</td>
                  <td className="px-4 py-3 text-center">{totalByNeighborhood.expectedVotes}</td>
                  <td className="px-4 py-3 text-center">{totalByNeighborhood.adminEstimatedVotes}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-secondary/20 bg-secondary/5 p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Por local de votação</p>
          <form className="no-print flex flex-wrap gap-2">
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
        <p className="mb-3 text-xs text-foreground/50">
          Compara o informado pelas lideranças com o eleitorado total registrado em cada local, segundo o TSE — não é
          resultado de urna (o sistema ainda não importa esse dado, que só existe depois da eleição), é a referência
          de quantos eleitores existem ali, pra ver se a expectativa é realista.
          {leadersWithoutLocation > 0 && (
            <> {leadersWithoutLocation} liderança(s) ainda não têm local de votação cadastrado e não entram nesta tabela.</>
          )}
        </p>

        <div className="no-print grid gap-3 sm:hidden">
          {byPollingLocation.map((row) => (
            <div key={row.id} className="rounded-lg border border-black/5 bg-white p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{row.label}</p>
                <span className="text-xs text-foreground/60">{row.leaderCount} liderança(s)</span>
              </div>
              <p className="text-xs text-foreground/50">{row.city ?? "—"}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
                <span>Informado: {row.expectedVotes}</span>
                <span>Avaliação admin: {row.adminEstimatedVotes}</span>
                <span>Eleitorado (TSE): {row.registeredVoters ?? "—"}</span>
                <span>Cobertura: {row.coveragePct != null ? `${row.coveragePct}%` : "—"}</span>
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
                <th className="px-4 py-3 text-center">Lideranças</th>
                <th className="px-4 py-3 text-center">Informado (liderança)</th>
                <th className="px-4 py-3 text-center">Avaliação (admin)</th>
                <th className="px-4 py-3 text-center">Eleitorado (TSE)</th>
                <th className="px-4 py-3 text-center">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {byPollingLocation.map((row) => (
                <tr key={row.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-foreground/70">{row.city ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{row.leaderCount}</td>
                  <td className="px-4 py-3 text-center">{row.expectedVotes}</td>
                  <td className="px-4 py-3 text-center">{row.adminEstimatedVotes}</td>
                  <td className="px-4 py-3 text-center">{row.registeredVoters ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{row.coveragePct != null ? `${row.coveragePct}%` : "—"}</td>
                </tr>
              ))}
              {byPollingLocation.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-foreground/50">
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
