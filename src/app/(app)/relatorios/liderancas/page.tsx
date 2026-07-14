import Link from "next/link"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getLeadersByNeighborhoodReport } from "@/services/reports"
import { listDistinctLeaderCities, listDistinctLeaderNeighborhoods } from "@/services/leaders"
import { LEADER_STATUS_LABELS, type LeaderStatus } from "@/types/domain"
import { PrintButton } from "@/components/print-button"
import { PrintLogo } from "@/components/print-logo"

export const metadata: Metadata = { title: "Lideranças por bairro · Lidera+" }

type SearchParams = { cidade?: string; bairro?: string }

// Filtro em cascata: o dropdown de bairro só mostra os bairros da cidade
// escolhida (listDistinctLeaderNeighborhoods recebe { city } opcional) — por
// isso é um formulário GET de sempre (recarrega a página a cada escolha) em
// vez de um <select> dependente via JS: primeiro escolhe a cidade e filtra,
// aí o bairro já vem só com as opções daquela cidade, escolhe e filtra de
// novo. Sem JS extra, mesmo padrão zero-client-state do resto do relatório.
export default async function RelatorioLiderancasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const [rows, cities, neighborhoods] = await Promise.all([
    getLeadersByNeighborhoodReport(supabase, { city: params.cidade, neighborhood: params.bairro }),
    listDistinctLeaderCities(supabase),
    listDistinctLeaderNeighborhoods(supabase, { city: params.cidade }),
  ])

  const pdfParams = new URLSearchParams()
  if (params.cidade) pdfParams.set("cidade", params.cidade)
  if (params.bairro) pdfParams.set("bairro", params.bairro)
  const pdfQuery = pdfParams.toString()

  return (
    <div className="space-y-6">
      <PrintLogo />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Lideranças por bairro</h1>
          <p className="text-sm text-foreground/60">{rows.length} lideranças.</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link href={`/relatorios/liderancas/pdf${pdfQuery ? `?${pdfQuery}` : ""}`}
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
        <select name="bairro" defaultValue={params.bairro ?? ""}
          className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todos os bairros</option>
          {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
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
                  {row.neighborhood ?? "Sem bairro"}{row.city ? ` · ${row.city}` : ""}
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
                  <th className="px-4 py-3">Bairro</th>
                  <th className="px-4 py-3">Cidade</th>
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
                    <td className="px-4 py-3 text-foreground/70">{row.neighborhood ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground/70">{row.city ?? "—"}</td>
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
