import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listLeaders } from "@/services/leaders"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { SupporterForm } from "../supporter-form"
import { createSupporterAction } from "../actions"

export const metadata: Metadata = { title: "Novo apoiador · Lidera+" }

export default async function NovoApoiadorPage() {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole

  if (!session || !can(role, "create", "supporters")) {
    redirect("/apoiadores")
  }

  const isLideranca = role === "lideranca"
  const supabase = await createClient()
  const leaders = isLideranca ? [] : await listLeaders(supabase)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Novo apoiador</h1>
        {isLideranca && (
          <p className="text-sm text-foreground/60">Cadastrado automaticamente na sua rede.</p>
        )}
      </div>
      <SupporterForm
        action={createSupporterAction}
        leaders={leaders.map((l) => ({ id: l.id, name: l.name }))}
        lockedToOwnNetwork={isLideranca}
        cancelHref="/apoiadores"
      />
    </div>
  )
}
