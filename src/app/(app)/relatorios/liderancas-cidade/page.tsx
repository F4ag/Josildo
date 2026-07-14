import Link from "next/link"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getLeadersByNeighborhoodReport } from "@/services/reports"
import { listDistinctLeaderCities } from "@/services/leaders"
import { LEADER_STATUS_LABELS, type LeaderStatus } from "@/types/domain"
import { PrintButton } from "@/components/print-button"
import { PrintLogo } from "@/components/print-logo"

export const metadata: Metadata = { title: "Lideranças por cidade · Lidera+" }

type SearchParams = { cidade?: string }

// Mesmo relatório de liderancas/page.tsx (mesmos dados, mesma agregação em
// services/reports.ts), só que ordenado/organizado por cidade em vez de
// bairro — pedido explícito da Agência F4 como um relatório separado (com
// PDF próprio), não só um filtro dentro do "por bairro".
export default async function RelatorioLiderancasPorCidadePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const [rows, cities] = await Promise.all([
    getLeadersByNeighborhoodReport(supabase, { city: params.cidade, sortBy: "city" }),
    listDistinctLeaderCities(supabase),
  ])

  return (
    <div className="space-y-6">
      <PrintLogo />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Lideranças por cidade</h1>
          <p className="text-sm text-foreground/60">{rows.length} lideranças.</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link href={`/relatorios/liderancas-cidade/pdf${params.cidade ? `?cidade=${encodeURIComponent(params.cidade)}` : ""}`}
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

      {rows.length === 0 ? (
        <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
          Nenhuma liderança cadastrada.
        </div>
      ) : (
        <>
          <div className="no-print grid gap-3 sm:hidden">
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-black/5 bg-white p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{row.name}</p>
                  <span className="text-xs text-foreground/60">
                    {LEADER_STATUS_LABELS[row.status as LeaderStatus] ?? row.status}
                  </span>
                </div>
                <p className="text-sm text-foreground/60">
                  {row.city ?? "Sem cidade"}{row.neighborhood ? ` · ${row.neighborhood}` : ""}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
                  <span>Apoiadores: {row.supporterCount}</span>
                  <span>Demandas: {row.demandCount}</span>
                  <span>Resolvidas: {row.demandResolvedCount}</span>
                  <span>Atendimentos: {row.attendanceCount}</span>
                </div>
                <p className="mt-2 text-xs text-foreground/50">
                  Última interação: {row.lastInteractionAt ? new Date(row.lastInteractionAt).toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
                <tr>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3">Bairro</th>
                  <th className="px-4 py-3">Liderança</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3 text-center">Apoiadores</th>
                  <th className="px-4 py-3 text-center">Demandas</th>
                  <th className="px-4 py-3 text-center">Resolvidas</th>
                  <th className="px-4 py-3 text-center">Atendimentos</th>
                  <th className="px-4 py-3">Última interação</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-black/5">
                    <td className="px-4 py-3 text-foreground/70">{row.city ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground/70">{row.neighborhood ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-foreground/70">{row.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-center">{row.supporterCount}</td>
                    <td className="px-4 py-3 text-center">{row.demandCount}</td>
                    <td className="px-4 py-3 text-center">{row.demandResolvedCount}</td>
                    <td className="px-4 py-3 text-center">{row.attendanceCount}</td>
                    <td className="px-4 py-3 text-foreground/70">
                      {row.lastInteractionAt ? new Date(row.lastInteractionAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {LEADER_STATUS_LABELS[row.status as LeaderStatus] ?? row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
