import Link from "next/link"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { listLeaders, listDistinctLeaderCities, listDistinctLeaderNeighborhoods } from "@/services/leaders"
import { listSupporters, listDistinctSupporterCities, listDistinctSupporterNeighborhoods } from "@/services/supporters"
import { buildMailingLabel } from "@/lib/mailing-label"

export const metadata: Metadata = { title: "Etiquetas de correspondência · Lidera+" }

type Tipo = "lideranca" | "apoiador"
type SearchParams = { tipo?: Tipo; cidade?: string; bairro?: string }

export default async function EtiquetasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const tipo: Tipo = params.tipo === "apoiador" ? "apoiador" : "lideranca"
  const supabase = await createClient()

  const [rows, cities, neighborhoods] = await Promise.all([
    tipo === "lideranca"
      ? listLeaders(supabase, { city: params.cidade, neighborhood: params.bairro })
      : listSupporters(supabase, { city: params.cidade, neighborhood: params.bairro }),
    tipo === "lideranca" ? listDistinctLeaderCities(supabase) : listDistinctSupporterCities(supabase),
    tipo === "lideranca"
      ? listDistinctLeaderNeighborhoods(supabase, { city: params.cidade })
      : listDistinctSupporterNeighborhoods(supabase, { city: params.cidade }),
  ])

  const labels = rows.map((r) => buildMailingLabel(r))

  const pdfParams = new URLSearchParams({ tipo })
  if (params.cidade) pdfParams.set("cidade", params.cidade)
  if (params.bairro) pdfParams.set("bairro", params.bairro)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Etiquetas de correspondência</h1>
          <p className="text-sm text-foreground/60">
            {labels.length} etiqueta{labels.length === 1 ? "" : "s"} (15x5cm, uma por página) — Nome e endereço completo.
          </p>
        </div>
        {labels.length > 0 && (
          <Link
            href={`/relatorios/etiquetas/pdf?${pdfParams.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden />
            Baixar PDF
          </Link>
        )}
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="tipo" value="lideranca" defaultChecked={tipo === "lideranca"} />
            Liderança
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="tipo" value="apoiador" defaultChecked={tipo === "apoiador"} />
            Apoiador
          </label>
        </div>
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

      {labels.length === 0 ? (
        <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
          Nenhum(a) {tipo === "lideranca" ? "liderança" : "apoiador"} encontrado(a) com esse filtro.
        </div>
      ) : (
        <div className="divide-y divide-black/5 rounded-lg border border-black/5 bg-white">
          {labels.map((label, i) => (
            <div key={i} className="px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{label.name}</p>
              {label.addressLines.map((line, j) => (
                <p key={j} className="text-foreground/60">{line}</p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
