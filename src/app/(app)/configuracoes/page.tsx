import Link from "next/link"
import type { Metadata } from "next"
import { Users, Vote } from "lucide-react"

export const metadata: Metadata = { title: "Configurações · Lidera+" }

// Antes redirecionava direto pra /configuracoes/usuarios (única sub-tela até
// então, ver Módulo 1/17). Agora que existe uma segunda (/configuracoes/
// eleicao, comparativo de votos), vira um índice simples com as duas opções.
export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/configuracoes/usuarios"
          className="rounded-lg border border-black/5 bg-white p-5 hover:border-primary/30">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 font-medium text-foreground">Usuários</p>
          <p className="mt-1 text-sm text-foreground/60">Quem tem acesso ao Lidera+ e com qual perfil.</p>
        </Link>
        <Link href="/configuracoes/eleicao"
          className="rounded-lg border border-black/5 bg-white p-5 hover:border-primary/30">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <Vote className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 font-medium text-foreground">Eleição</p>
          <p className="mt-1 text-sm text-foreground/60">
            Cargo, número do candidato e ano — usado no comparativo de votos com o resultado real do TSE.
          </p>
        </Link>
      </div>
    </div>
  )
}
