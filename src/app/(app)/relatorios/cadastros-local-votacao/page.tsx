import Link from "next/link"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getRegistrationsByPollingLocation, listDistinctRegistrationCities } from "@/services/reports"
import { PrintButton } from "@/components/print-button"
import { PrintLogo } from "@/components/print-logo"

export const metadata: Metadata = { title: "Cadastros por local de votação · Lidera+" }

type SearchParams = { cidade?: string }

// Relatório separado do de Expectativa de votos (/relatorios/votos): aqui
// não cruza expected_votes/admin_estimated_votes (campo só de leaders) — é
// só a contagem de lideranças + apoiadores vinculados a cada local de
// votação (polling_locations, dado do TSE), pedido explícito da Agência F4
// pra enxergar onde a base cadastrada está concentrada, independente de
// expectativa de voto. Ver services/reports.ts#getRegistrationsByPollingLocation.
export default async function RelatorioCadastrosPorLocalVotacaoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const [{ rows, leadersWithoutLocation, supportersWithoutLocation }, cities] = await Promise.all([
    getRegistrationsByPollingLocation(supabase, { city: params.cidade }),
    listDistinctRegistrationCities(supabase),
  ])

  const total = rows.reduce(
    (acc, row) => ({
      leaderCount: acc.leaderCount + row.leaderCount,
      supporterCount: acc.supporterCount + row.supporterCount,
      totalCount: acc.totalCount + row.totalCount,
    }),
    { leaderCount: 0, supporterCount: 0, totalCount: 0 },
  )

  const pdfParams = new URLSearchParams()
  if (params.cidade) pdfParams.set("cidade", params.cidade)
  const pdfQuery = pdfParams.toString()

  return (
    <div className="space-y-6">
      <PrintLogo />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cadastros por local de votação</h1>
          <p className="text-sm text-foreground/60">
            Quantas lideranças e apoiadores estão vinculados a cada local de votação — não é expectativa de voto,
            é a contagem de quem já tem esse campo preenchido no cadastro.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link href={`/relatorios/cadastros-local-votacao/pdf${pdfQuery ? `?${pdfQuery}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Download className="h-4 w-4" aria-hidden />
            Baixar PDF
          </Link>
          <PrintButton />
        </div>
      </div>

      <form className="no-print flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
        <select name="cidade" defaultValue={params.cidade ?? ""}
          className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todas as cidades</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          Filtrar
        </button>
      </form>

      {(leadersWithoutLocation > 0 || supportersWithoutLocation > 0) && (
        <p className="text-xs text-foreground/50">
          {leadersWithoutLocation > 0 && <>{leadersWithoutLocation} liderança(s) </>}
          {leadersWithoutLocation > 0 && supportersWithoutLocation > 0 && "e "}
          {supportersWithoutLocation > 0 && <>{supportersWithoutLocation} apoiador(es) </>}
          ainda não têm local de votação cadastrado e não entram nesta tabela.
        </p>
      )}

      <div className="no-print grid gap-3 sm:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-black/5 bg-white p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="font-medium text-foreground">{row.label}</p>
              <span className="text-xs text-foreground/60">{row.totalCount} cadastro(s)</span>
            </div>
            <p className="text-xs text-foreground/50">{row.city ?? "—"}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
              <span>Lideranças: {row.leaderCount}</span>
              <span>Apoiadores: {row.supporterCount}</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
            Nenhum cadastro com local de votação vinculado ainda.
          </div>
        )}
        {rows.length > 0 && (
          <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="font-semibold text-foreground">Total</p>
              <span className="text-xs text-foreground/60">{total.totalCount} cadastro(s)</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
              <span>Lideranças: {total.leaderCount}</span>
              <span>Apoiadores: {total.supporterCount}</span>
            </div>
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
              <th className="px-4 py-3 text-center">Apoiadores</th>
              <th className="px-4 py-3 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-medium">{row.label}</td>
                <td className="px-4 py-3 text-foreground/70">{row.city ?? "—"}</td>
                <td className="px-4 py-3 text-center">{row.leaderCount}</td>
                <td className="px-4 py-3 text-center">{row.supporterCount}</td>
                <td className="px-4 py-3 text-center">{row.totalCount}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">
                  Nenhum cadastro com local de votação vinculado ainda.
                </td>
              </tr>
            )}
            {rows.length > 0 && (
              <tr className="border-t border-black/10 bg-black/[0.02] font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-center">{total.leaderCount}</td>
                <td className="px-4 py-3 text-center">{total.supporterCount}</td>
                <td className="px-4 py-3 text-center">{total.totalCount}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
