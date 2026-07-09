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
  if (!session || !can(session.profile.role as UserRole, "create", "leaders")) {
    redirect("/liderancas")
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Nova liderança</h1>
      <LeaderForm action={createLeaderAction} cancelHref="/liderancas" />
    </div>
  )
}
