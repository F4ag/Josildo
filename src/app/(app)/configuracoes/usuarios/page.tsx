import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth"
import { listUserProfiles } from "@/services/users"
import { USER_ROLE_LABELS, type UserRole } from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { StatusToggleButton } from "./status-toggle-button"
import { DeleteUserButton } from "./delete-user-button"

export const metadata: Metadata = { title: "Usuários · Lidera+" }

// Acesso restrito a admin_geral — já garantido pelo middleware.ts
// (ADMIN_GERAL_ONLY_ROUTE_PREFIXES em src/lib/permissions.ts).
export default async function UsuariosPage() {
  const supabase = await createClient()
  const [users, session] = await Promise.all([listUserProfiles(supabase), getSessionUser()])

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

      {users.length === 0 ? (
        <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
          Nenhum usuário cadastrado ainda.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:hidden">
            {users.map((user) => (
              <div key={user.id} className="rounded-lg border border-black/5 bg-white p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{user.full_name}</p>
                  <Badge tone={user.status === "ativo" ? "verde" : "vermelho"}>
                    {user.status === "ativo" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/60">{user.email}</p>
                <p className="text-sm text-foreground/60">
                  {USER_ROLE_LABELS[user.role as UserRole]}
                  {user.leaders?.name ? ` · ${user.leaders.name}` : ""}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <StatusToggleButton userId={user.id} status={user.status as "ativo" | "inativo"} />
                  {user.id !== session?.id && (
                    <DeleteUserButton userId={user.id} userName={user.full_name} />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <StatusToggleButton userId={user.id} status={user.status as "ativo" | "inativo"} />
                        {user.id !== session?.id && (
                          <DeleteUserButton userId={user.id} userName={user.full_name} />
                        )}
                      </div>
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
