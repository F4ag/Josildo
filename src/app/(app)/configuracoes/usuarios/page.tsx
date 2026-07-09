import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { listUserProfiles } from "@/services/users"
import { USER_ROLE_LABELS, type UserRole } from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { StatusToggleButton } from "./status-toggle-button"

export const metadata: Metadata = { title: "Usuários · Lidera+" }

// Acesso restrito a admin_geral — já garantido pelo middleware.ts
// (ADMIN_GERAL_ONLY_ROUTE_PREFIXES em src/lib/permissions.ts).
export default async function UsuariosPage() {
  const supabase = await createClient()
  const users = await listUserProfiles(supabase)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Usuários</h1>
          <p className="text-sm text-foreground/60">
            Quem tem acesso ao Lidera+ e com qual perfil.
          </p>
        </div>
        <Link
          href="/configuracoes/usuarios/novo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Novo usuário
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Liderança</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-medium">{user.full_name}</td>
                <td className="px-4 py-3 text-foreground/70">{user.email}</td>
                <td className="px-4 py-3">{USER_ROLE_LABELS[user.role as UserRole]}</td>
                <td className="px-4 py-3 text-foreground/70">{user.leaders?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={user.status === "ativo" ? "verde" : "vermelho"}>
                    {user.status === "ativo" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <StatusToggleButton userId={user.id} status={user.status as "ativo" | "inativo"} />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground/50">
                  Nenhum usuário cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
