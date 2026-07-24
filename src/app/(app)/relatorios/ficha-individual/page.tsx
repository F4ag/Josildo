import Link from "next/link"
import type { Metadata } from "next"
import { Download, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth"
import { listLeaders, getLeaderById } from "@/services/leaders"
import { listSupporters, getSupporterById } from "@/services/supporters"
import { getPollingLocationById, formatPollingLocationLabel } from "@/services/polling-locations"
import { buildLeaderFicha, buildSupporterFicha, type FichaData } from "@/lib/ficha-individual"
import type { UserRole } from "@/types/domain"
import { PrintButton } from "@/components/print-button"
import { PrintLogo } from "@/components/print-logo"

export const metadata: Metadata = { title: "Ficha individual · Lidera+" }

type Tipo = "lideranca" | "apoiador"
type SearchParams = { tipo?: Tipo; busca?: string; id?: string }

export default async function FichaIndividualPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const tipo: Tipo = params.tipo === "apoiador" ? "apoiador" : "lideranca"
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole
  const supabase = await createClient()

  // Registro já selecionado (?id=...) — monta e mostra a ficha completa.
  if (params.id) {
    if (tipo === "lideranca") {
      const leader = await getLeaderById(supabase, params.id)
      if (!leader) return <NotFoundState tipo={tipo} />
      const [pollingLocation, parentLeader] = await Promise.all([
        leader.polling_location_id ? getPollingLocationById(supabase, leader.polling_location_id) : Promise.resolve(null),
        leader.parent_leader_id ? getLeaderById(supabase, leader.parent_leader_id) : Promise.resolve(null),
      ])
      const ficha = buildLeaderFicha(leader, {
        pollingLocationLabel: pollingLocation ? formatPollingLocationLabel(pollingLocation) : null,
        parentLeaderName: parentLeader?.name ?? null,
        role,
      })
      return <FichaView ficha={ficha} pdfHref={`/relatorios/ficha-individual/pdf?tipo=lideranca&id=${leader.id}`} />
    }

    const supporter = await getSupporterById(supabase, params.id)
    if (!supporter) return <NotFoundState tipo={tipo} />
    const [pollingLocation, leader] = await Promise.all([
      supporter.polling_location_id ? getPollingLocationById(supabase, supporter.polling_location_id) : Promise.resolve(null),
      supporter.leader_id ? getLeaderById(supabase, supporter.leader_id) : Promise.resolve(null),
    ])
    const ficha = buildSupporterFicha(supporter, {
      pollingLocationLabel: pollingLocation ? formatPollingLocationLabel(pollingLocation) : null,
      leaderName: leader?.name ?? null,
    })
    return <FichaView ficha={ficha} pdfHref={`/relatorios/ficha-individual/pdf?tipo=apoiador&id=${supporter.id}`} />
  }

  // Sem id ainda: busca por nome, dentro do tipo escolhido.
  const results = params.busca
    ? tipo === "lideranca"
      ? (await listLeaders(supabase, { search: params.busca })).map((l) => ({
          id: l.id,
          name: l.name,
          subtitle: [l.neighborhood, l.city].filter(Boolean).join(" · "),
        }))
      : (await listSupporters(supabase, { search: params.busca })).map((s) => ({
          id: s.id,
          name: s.name,
          subtitle: [s.neighborhood, s.city].filter(Boolean).join(" · "),
        }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Ficha individual</h1>
        <p className="text-sm text-foreground/60">
          Busque uma liderança ou apoiador para imprimir ou baixar em PDF a ficha completa, com todos os dados cadastrados.
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-3 rounded-lg border border-black/5 bg-white p-4">
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
        <input type="search" name="busca" defaultValue={params.busca} placeholder="Buscar por nome..."
          className="min-w-56 flex-1 rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          Buscar
        </button>
      </form>

      {params.busca && (
        results.length === 0 ? (
          <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
            Nenhum(a) {tipo === "lideranca" ? "liderança" : "apoiador"} encontrado(a) com esse nome.
          </div>
        ) : (
          <div className="divide-y divide-black/5 rounded-lg border border-black/5 bg-white">
            {results.map((r) => (
              <Link
                key={r.id}
                href={`/relatorios/ficha-individual?tipo=${tipo}&busca=${encodeURIComponent(params.busca ?? "")}&id=${r.id}`}
                className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-black/[0.02]"
              >
                <span className="font-medium text-foreground">{r.name}</span>
                <span className="text-foreground/50">{r.subtitle || "—"}</span>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function NotFoundState({ tipo }: { tipo: Tipo }) {
  return (
    <div className="space-y-4">
      <Link href="/relatorios/ficha-individual" className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Nova busca
      </Link>
      <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
        {tipo === "lideranca" ? "Liderança" : "Apoiador"} não encontrado(a).
      </div>
    </div>
  )
}

function FichaView({ ficha, pdfHref }: { ficha: FichaData; pdfHref: string }) {
  return (
    <div className="space-y-6 print:space-y-1">
      <PrintLogo />
      <div className="no-print flex items-center justify-between">
        <Link href="/relatorios/ficha-individual" className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Nova busca
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={pdfHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden />
            Baixar PDF
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="print:mb-1">
        <h1 className="text-xl font-semibold text-foreground print:text-sm">
          Ficha individual — {ficha.kind === "lideranca" ? "Liderança" : "Apoiador"}
        </h1>
        <p className="text-sm text-foreground/60 print:text-xs">{ficha.name}</p>
      </div>

      {/* Na tela cada seção é um card espaçado (bom pra leitura); no papel
       * essa mesma folga (padding/gap/space-y) é o que estourava pra 2
       * páginas — por isso as classes print: aqui comprimem tudo bem mais
       * (fontes, espaçamentos, 1 coluna a mais no grid) sem mudar o layout
       * em tela. */}
      <div className="space-y-4 print:space-y-0">
        {ficha.sections.map((section) => (
          <div
            key={section.title}
            className="rounded-lg border border-black/5 bg-white p-5 print:break-inside-avoid print:rounded-none print:border-0 print:border-b print:border-black/10 print:p-1"
          >
            <p className="mb-3 text-sm font-semibold text-foreground print:mb-0.5 print:text-[9px]">{section.title}</p>
            <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-3 print:gap-x-3 print:gap-y-0.5">
              {section.fields.map((field) => (
                <div key={field.label} className={field.label === "Observações" ? "sm:col-span-2 print:col-span-3" : undefined}>
                  <p className="text-xs uppercase text-foreground/50 print:text-[6px] print:leading-tight">{field.label}</p>
                  <p className="text-sm text-foreground print:text-[8px] print:leading-tight">{field.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
