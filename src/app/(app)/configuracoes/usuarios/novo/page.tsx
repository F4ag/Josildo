import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { listLeadersWithoutAccount } from "@/services/leaders"
import { UserForm } from "./user-form"

export const metadata: Metadata = { title: "Novo usuário · Lidera+" }

export default async function NovoUsuarioPage() {
  const supabase = await createClient()
  const leadersWithoutAccount = await listLeadersWithoutAccount(supabase)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Novo usuário</h1>
        <p className="text-sm text-foreground/60">
          A pessoa recebe um e-mail de convite para definir a própria senha.
        </p>
      </div>
      <UserForm leadersWithoutAccount={leadersWithoutAccount} />
    </div>
  )
}
