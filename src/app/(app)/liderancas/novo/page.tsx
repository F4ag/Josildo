import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { LeaderForm } from "../leader-form"
import { createLeaderAction } from "../actions"

export const metadata: Metadata = { title: "Nova liderança · Lidera+" }

export default async function NovaLiderancaPage() {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole
  if (!session || !can(role, "create", "leaders")) {
    redirect("/liderancas")
  }

  const isLideranca = role === "lideranca"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Nova liderança</h1>
        {isLideranca && (
          <p className="text-sm text-foreground/60">
            Essa liderança entra na sua rede — você vai poder acompanhá-la aqui em Lideranças.
          </p>
        )}
      </div>
      <LeaderForm action={createLeaderAction} cancelHref="/liderancas" hideAdminFields={isLideranca} />
    </div>
  )
}
