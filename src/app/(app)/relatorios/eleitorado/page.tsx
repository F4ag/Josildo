import Link from "next/link"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import {
  getElectorateByCity,
  getElectorateByNeighborhood,
  getElectorateByPollingLocation,
  listDistinctElectorateCities,
  listDistinctElectorateNeighborhoods,
} from "@/services/electorate"
import { PrintButton } from "@/components/print-button"
import { PrintLogo } from "@/components/print-logo"

export const metadata: Metadata = { title: "Eleitorado (TSE) · Lidera+" }

type SearchParams = { cidade?: string; bairro?: string }

// Relatório de consulta pura ao eleitorado (dado aberto do TSE, tabela
// polling_locations — ver schema.sql e services/electorate.ts). Diferente do
// relatório "Expectativa de votos" (/relatorios/votos), aqui não cruza nada
// com lideranças/apoiadores: é só quantos eleitores existem registrados em
// cada cidade/bairro/local de votação, pedido da Agência F4 depois de ver a
// coluna "Eleitorado (TSE)" naquele outro relatório. Mesmo padrão de filtro
// em cascata cidade→bairro e cores por seção do resto do módulo.
export default async function RelatorioEleitoradoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const [byCity, byNeighborhood, byPollingLocation, cities, neighborhoods, geral] = await Promise.all([
    getElectorateByCity(supabase, { city: params.cidade }),
    getElectorateByNeighborhood(supabase, { city: params.cidade, bairro: params.bairro }),
    getElectorateByPollingLocation(supabase, { city: params.cidade, bairro: params.bairro }),
    listDistinctElectorateCities(supabase),
    listDistinctElectorateNeighborhoods(supabase, { city: params.cidade }),
    getElectorateByCity(supabase),
  ])

  const totalGeral = geral.reduce(
    (acc, row) => ({ eleitores: acc.eleitores + row.eleitores, locationCount: acc.locationCount + row.locationCount }),
    { eleitores: 0, locationCount: 0 },
  )

  const pdfParams = new URLSearchParams()
  if (params.cidade) pdfParams.set("cidade", params.cidade)
  if (params.bairro) pdfParams.set("bairro", params.bairro)
  const pdfQuery = pdfParams.toString()

  const totalByCity = byCity.reduce(
    (acc, row) => ({ eleitores: acc.eleitores + row.eleitores, locationCount: acc.locationCount + row.locationCount }),
    { eleitores: 0, locationCount: 0 },
  )
  const totalByNeighborhood = byNeighborhood.reduce(
    (acc, row) => ({ eleitores: acc.eleitores + row.eleitores, locationCount: acc.locationCount + row.locationCount }),
    { eleitores: 0, locationCount: 0 },
  )
  const totalByPollingLocation = byPollingLocation.reduce((acc, row) => acc + (row.eleitores ?? 0), 0)

  return (
    <div className="space-y-6">
      <PrintLogo />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Eleitorado (TSE)</h1>
          <p className="text-sm text-foreground/60">
            Consulta ao eleitorado registrado por cidade, bairro e local de votação — dado aberto do TSE, sem cruzar
            com cadastros de lideranças ou apoiadores.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link href={`/relatorios/eleitorado/pdf${pdfQuery ? `?${pdfQuery}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Download className="h-4 w-4" aria-hidden />
            Baixar PDF
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Eleitorado total</p>
          <p className="text-2xl font-semibold text-foreground">{totalGeral.eleitores.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-xs text-foreground/50">Soma de todos os locais de votação importados.</p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Locais de votação</p>
          <p className="text-2xl font-semibold text-foreground">{totalGeral.locationCount}</p>
          <p className="mt-1 text-xs text-foreground/50">Cadastrados na base do TSE.</p>
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
                <span className="text-xs text-foreground/60">{row.locationCount} local(is)</span>
              </div>
              <p className="text-sm text-foreground/70">{row.eleitores.toLocaleString("pt-BR")} eleitores</p>
            </div>
          ))}
          {byCity.length === 0 && (
            <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
              Nenhum dado de eleitorado encontrado.
            </div>
          )}
          {byCity.length > 0 && (
            <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">Total</p>
                <span className="text-xs text-foreground/60">{totalByCity.locationCount} local(is)</span>
              </div>
              <p className="text-sm text-foreground/70">{totalByCity.eleitores.toLocaleString("pt-BR")} eleitores</p>
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
              <tr>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3 text-center">Locais de votação</th>
                <th className="px-4 py-3 text-center">Eleitorado</th>
              </tr>
            </thead>
            <tbody>
              {byCity.map((row) => (
                <tr key={row.label} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-center">{row.locationCount}</td>
                  <td className="px-4 py-3 text-center">{row.eleitores.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {byCity.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-foreground/50">
                    Nenhum dado de eleitorado encontrado.
                  </td>
                </tr>
              )}
              {byCity.length > 0 && (
                <tr className="border-t border-black/10 bg-black/[0.02] font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-center">{totalByCity.locationCount}</td>
                  <td className="px-4 py-3 text-center">{totalByCity.eleitores.toLocaleString("pt-BR")}</td>
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
                <span className="text-xs text-foreground/60">{row.locationCount} local(is)</span>
              </div>
              <p className="text-xs text-foreground/50">{row.city ?? "—"}</p>
              <p className="mt-1 text-sm text-foreground/70">{row.eleitores.toLocaleString("pt-BR")} eleitores</p>
            </div>
          ))}
          {byNeighborhood.length === 0 && (
            <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
              Nenhum dado de eleitorado encontrado.
            </div>
          )}
          {byNeighborhood.length > 0 && (
            <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">Total</p>
                <span className="text-xs text-foreground/60">{totalByNeighborhood.locationCount} local(is)</span>
              </div>
              <p className="mt-1 text-sm text-foreground/70">{totalByNeighborhood.eleitores.toLocaleString("pt-BR")} eleitores</p>
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
              <tr>
                <th className="px-4 py-3">Bairro</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3 text-center">Locais de votação</th>
                <th className="px-4 py-3 text-center">Eleitorado</th>
              </tr>
            </thead>
            <tbody>
              {byNeighborhood.map((row) => (
                <tr key={`${row.city ?? "sem-cidade"}-${row.label}`} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-foreground/70">{row.city ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{row.locationCount}</td>
                  <td className="px-4 py-3 text-center">{row.eleitores.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {byNeighborhood.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-foreground/50">
                    Nenhum dado de eleitorado encontrado.
                  </td>
                </tr>
              )}
              {byNeighborhood.length > 0 && (
                <tr className="border-t border-black/10 bg-black/[0.02] font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-center">{totalByNeighborhood.locationCount}</td>
                  <td className="px-4 py-3 text-center">{totalByNeighborhood.eleitores.toLocaleString("pt-BR")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-secondary/20 bg-secondary/5 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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

        <div className="no-print grid gap-3 sm:hidden">
          {byPollingLocation.map((row) => (
            <div key={row.id} className="rounded-lg border border-black/5 bg-white p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{row.nome}</p>
                <span className="text-xs text-foreground/60">{(row.eleitores ?? 0).toLocaleString("pt-BR")}</span>
              </div>
              <p className="text-xs text-foreground/50">
                {row.bairro ?? "Sem bairro"} · {row.city}
              </p>
              {row.endereco && <p className="mt-1 text-xs text-foreground/40">{row.endereco}</p>}
            </div>
          ))}
          {byPollingLocation.length === 0 && (
            <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
              Nenhum dado de eleitorado encontrado.
            </div>
          )}
          {byPollingLocation.length > 0 && (
            <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">Total</p>
                <span className="text-xs text-foreground/60">{totalByPollingLocation.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
              <tr>
                <th className="px-4 py-3">Local de votação</th>
                <th className="px-4 py-3">Bairro</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3 text-center">Eleitorado</th>
              </tr>
            </thead>
            <tbody>
              {byPollingLocation.map((row) => (
                <tr key={row.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{row.nome}</td>
                  <td className="px-4 py-3 text-foreground/70">{row.bairro ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground/70">{row.city}</td>
                  <td className="px-4 py-3 text-center">{(row.eleitores ?? 0).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {byPollingLocation.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-foreground/50">
                    Nenhum dado de eleitorado encontrado.
                  </td>
                </tr>
              )}
              {byPollingLocation.length > 0 && (
                <tr className="border-t border-black/10 bg-black/[0.02] font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-center">{totalByPollingLocation.toLocaleString("pt-BR")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
