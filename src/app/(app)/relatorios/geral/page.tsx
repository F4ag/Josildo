import Link from "next/link"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import {
  getAllRegistrationsReport,
  listDistinctRegistrationCities,
  listDistinctRegistrationNeighborhoods,
} from "@/services/reports"
import { PrintButton } from "@/components/print-button"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Todos os cadastros · Lidera+" }

type SearchParams = { cidade?: string; bairro?: string }

// Relatório geral pedido pelo cliente: "um relatório só, com filtros" — em vez
// de 3 páginas separadas (cidade / bairro / geral), uma única listagem que
// junta lideranças + apoiadores, com o mesmo filtro em cascata cidade→bairro
// dos outros relatórios (GET form, recarrega a página a cada escolha).
export default async function RelatorioGeralPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const [rows, cities, neighborhoods] = await Promise.all([
    getAllRegistrationsReport(supabase, { city: params.cidade, neighborhood: params.bairro }),
    listDistinctRegistrationCities(supabase),
    listDistinctRegistrationNeighborhoods(supabase, { city: params.cidade }),
  ])

  const liderancaCount = rows.filter((r) => r.kind === "lideranca").length
  const apoiadorCount = rows.filter((r) => r.kind === "apoiador").length

  const pdfParams = new URLSearchParams()
  if (params.cidade) pdfParams.set("cidade", params.cidade)
  if (params.bairro) pdfParams.set("bairro", params.bairro)
  const pdfQuery = pdfParams.toString()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Todos os cadastros</h1>
          <p className="text-sm text-foreground/60">
            {rows.length} cadastros ({liderancaCount} lideranças, {apoiadorCount} apoiadores).
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link href={`/relatorios/geral/pdf${pdfQuery ? `?${pdfQuery}` : ""}`}
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
          Nenhum cadastro encontrado.
        </div>
      ) : (
        <>
          <div className="no-print grid gap-3 sm:hidden">
            {rows.map((row) => (
              <div key={`${row.kind}-${row.id}`} className="rounded-lg border border-black/5 bg-white p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{row.name}</p>
                  <Badge tone={row.kind === "lideranca" ? "azul" : "verde"}>
                    {row.kind === "lideranca" ? "Liderança" : "Apoiador"}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/60">
                  {row.neighborhood ?? "Sem bairro"}{row.city ? ` · ${row.city}` : ""}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
                {row.kind === "apoiador" && (
                  <p className="mt-1 text-xs text-foreground/50">
                    Liderança: {row.leaderName ?? "—"}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
                <tr>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3">Bairro</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Liderança vinculada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-t border-black/5">
                    <td className="px-4 py-3 text-foreground/70">{row.city ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground/70">{row.neighborhood ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={row.kind === "lideranca" ? "azul" : "verde"}>
                        {row.kind === "lideranca" ? "Liderança" : "Apoiador"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-foreground/70">{row.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground/70">{row.leaderName ?? "—"}</td>
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
