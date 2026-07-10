import Link from "next/link"
import type { Metadata } from "next"
import { Users, HeartHandshake, type LucideIcon } from "lucide-react"
import { clsx } from "clsx"

export const metadata: Metadata = { title: "Relatórios · Lidera+" }

// "color" aqui é só pro badge de ícone no canto do card (bg-{cor}/10,
// texto sólido) — os cards continuam brancos, diferente dos StatCard
// coloridos usados no Dashboard e nas listagens. Reaproveita os mesmos
// tokens de marca (ver tailwind.config.ts) pra manter a mesma paleta.
const REPORTS: { href: string; title: string; description: string; icon: LucideIcon; color: string }[] = [
  {
    href: "/relatorios/liderancas",
    title: "Lideranças por bairro",
    description: "Apoiadores, demandas e atendimentos por liderança, agrupados por bairro.",
    icon: Users,
    color: "primary",
  },
  {
    href: "/relatorios/pessoas-atendidas",
    title: "Pessoas atendidas",
    description: "Todo apoiador com demanda ou atendimento registrado, com totais e status.",
    icon: HeartHandshake,
    color: "supporter",
  },
]

const BADGE_CLASSES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  supporter: "bg-supporter/10 text-supporter",
}

// Só os 2 relatórios do MVP (Módulo 11.1 e 11.5). Crescimento, ranking e
// bairros fracos (11.2 a 11.7) entram na v2, quando houver histórico
// suficiente para os indicadores serem confiáveis.
export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
        <p className="text-sm text-foreground/60">Visualize na tela, baixe em PDF ou imprima.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}
            className="rounded-lg border border-black/5 bg-white p-5 hover:border-primary/30">
            <span className={clsx("flex h-10 w-10 items-center justify-center rounded-full", BADGE_CLASSES[r.color])}>
              <r.icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 font-medium text-foreground">{r.title}</p>
            <p className="mt-1 text-sm text-foreground/60">{r.description}</p>
          </Link>
        ))}
      </div>

      <p className="text-xs text-foreground/40">
        Crescimento, ranking de lideranças e bairros descobertos (Módulo 11.2 a 11.7 do prompt
        master) entram na v2, quando houver histórico suficiente de dados.
      </p>
    </div>
  )
}
