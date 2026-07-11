import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { listOrganizationsWithAdmin } from "@/services/organizations"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Clientes · Lidera+" }

// Mesma constante de lib/supabase/middleware.ts: a organização "Lidera+"
// (cliente original, pré-multi-tenant) atende pelo domínio raiz, sem
// subdomínio — as demais usam slug.{ROOT_DOMAIN} normalmente.
const DEFAULT_ORG_SLUG = "lidera-mais"

// Painel cross-tenant — só existe pra quem tem is_platform_admin (Agência
// F4). notFound() em vez de redirect pra não revelar nem que a rota existe
// pra quem não devia estar aqui (mesmo raciocínio usado em getLeaderById
// quando a RLS filtra a linha).
export default async function ClientesPage() {
  const session = await getSessionUser()
  if (!session?.profile.is_platform_admin) notFound()

  const admin = createAdminClient()
  const organizations = await listOrganizationsWithAdmin(admin)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lideramais.app.br"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clientes</h1>
          <p className="text-sm text-foreground/60">
            Organizações provisionadas nesta instância do Lidera+.
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Novo cliente
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Subdomínio</th>
              <th className="px-4 py-3">Admin Geral</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => {
              const host = org.slug === DEFAULT_ORG_SLUG ? rootDomain : `${org.slug}.${rootDomain}`
              return (
                <tr key={org.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{org.name}</td>
                  <td className="px-4 py-3 text-foreground/70">
                    <a
                      href={`https://${host}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary hover:underline"
                    >
                      {host}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{org.admin_email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={org.status === "ativa" ? "verde" : "vermelho"}>
                      {org.status === "ativa" ? "Ativa" : org.status}
                    </Badge>
                  </td>
                </tr>
              )
            })}
            {organizations.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-foreground/50">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
