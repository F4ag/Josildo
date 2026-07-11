import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { ClientForm } from "./client-form"

export const metadata: Metadata = { title: "Novo cliente · Lidera+" }

export default async function NovoClientePage() {
  const session = await getSessionUser()
  if (!session?.profile.is_platform_admin) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Novo cliente</h1>
        <p className="text-sm text-foreground/60">
          Cria uma organização nova, isolada das demais, com subdomínio próprio. O responsável
          informado recebe um e-mail de convite para definir a senha e vira o Admin Geral dessa
          organização.
        </p>
      </div>
      <ClientForm />
    </div>
  )
}
