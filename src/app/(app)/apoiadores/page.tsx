import Link from "next/link"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listSupporters, listDistinctSupporterNeighborhoods } from "@/services/supporters"
import { SUPPORTER_ORIGINS, SUPPORTER_ORIGIN_LABELS, type SupporterOrigin, type UserRole } from "@/types/domain"
import { WhatsAppButton } from "@/components/whatsapp-button"
import { can } from "@/lib/permissions"

export const metadata: Metadata = { title: "Apoiadores · Lidera+" }

type SearchParams = { bairro?: string; origem?: SupporterOrigin; busca?: string }

export default async function ApoiadoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const session = await getSessionUser()
  const supabase = await createClient()
  const role = session?.profile.role as UserRole

  const [supporters, neighborhoods] = await Promise.all([
    listSupporters(supabase, {
      neighborhood: params.bairro,
      origin: params.origem,
      search: params.busca,
      leaderId: role === "lideranca" ? session?.profile.leader_id ?? undefined : undefined,
    }),
    listDistinctSupporterNeighborhoods(supabase),
  ])

  const canCreate = can(role, "create", "supporters")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Apoiadores</h1>
          <p className="text-sm text-foreground/60">{supporters.length} cadastrados com os filtros atuais.</p>
        </div>
        {canCreate && (
          <Link href="/apoiadores/novo"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Novo apoiador
          </Link>
        )}
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
        <input type="search" name="busca" defaultValue={params.busca} placeholder="Buscar por nome..."
          className="min-w-48 flex-1 rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        <select name="bairro" defaultValue={params.bairro ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todos os bairros</option>
          {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select name="origem" defaultValue={params.origem ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Toda origem</option>
          {SUPPORTER_ORIGINS.map((o) => <option key={o} value={o}>{SUPPORTER_ORIGIN_LABELS[o]}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Bairro</th>
              <th className="px-4 py-3">Liderança</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {supporters.map((s) => (
              <tr key={s.id} className="border-t border-black/5">
                <td className="px-4 py-3">
                  <Link href={`/apoiadores/${s.id}`} className="font-medium text-foreground hover:text-primary">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/70">{s.neighborhood ?? "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{s.leaders?.name ?? "—"}</td>
                <td className="px-4 py-3 text-foreground/70">
                  {s.origin ? SUPPORTER_ORIGIN_LABELS[s.origin as SupporterOrigin] : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <WhatsAppButton phone={s.phone} message={`Olá, ${s.name}!`} consentWhatsapp={s.consent_whatsapp} />
                </td>
              </tr>
            ))}
            {supporters.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">
                  Nenhum apoiador encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
