import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Download } from "lucide-react"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getVotesSummary, getVotesByCity, getVotesByNeighborhood } from "@/services/reports"
import { listDistinctLeaderCities } from "@/services/leaders"
import type { UserRole } from "@/types/domain"
import { PrintButton } from "@/components/print-button"
import { PrintLogo } from "@/components/print-logo"

export const metadata: Metadata = { title: "Expectativa de votos · Lidera+" }

type SearchParams = { cidade?: string }

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
  const [summary, byCity, cities, byNeighborhood] = await Promise.all([
    getVotesSummary(supabase),
    getVotesByCity(supabase),
    listDistinctLeaderCities(supabase),
    getVotesByNeighborhood(supabase, { city: params.cidade }),
  ])

  const pdfParams = new URLSearchParams()
  if (params.cidade) pdfParams.set("cidade", params.cidade)
  const pdfQuery = pdfParams.toString()

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
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Informado pelas lideranças</p>
          <p className="text-2xl font-semibold text-primary">{summary.totalExpectedVotes}</p>
          <p className="mt-1 text-xs text-foreground/50">
            {summary.leadersWithExpectedVotes} de {summary.totalLeaders} lideranças informaram uma expectativa.
          </p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Avaliação do Admin Geral</p>
          <p className="text-2xl font-semibold text-primary">{summary.totalAdminEstimatedVotes}</p>
          <p className="mt-1 text-xs text-foreground/50">
            {summary.leadersWithAdminEstimate} de {summary.totalLeaders} lideranças já foram avaliadas.
          </p>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-foreground">Por cidade</p>

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
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Por bairro</p>
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
