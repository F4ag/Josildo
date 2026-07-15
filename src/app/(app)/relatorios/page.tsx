import Link from "next/link"
import type { Metadata } from "next"
import { Users, MapPin, HeartHandshake, Layers, BarChart3, Landmark, type LucideIcon } from "lucide-react"
import { clsx } from "clsx"
import { getSessionUser } from "@/lib/auth"
import type { UserRole } from "@/types/domain"

export const metadata: Metadata = { title: "Relatórios · Lidera+" }

// "color" aqui é só pro badge de ícone no canto do card (bg-{cor}/10,
// texto sólido) — os cards continuam brancos, diferente dos StatCard
// coloridos usados no Dashboard e nas listagens. Reaproveita os mesmos
// tokens de marca (ver tailwind.config.ts) pra manter a mesma paleta.
// "adminOnly" restringe o card a admin_geral — mais restrito que o resto do
// módulo (que admin_equipe também acessa, ver ADMIN_ONLY_ROUTE_PREFIXES em
// lib/permissions.ts), usado só pelo relatório de Expectativa de votos, que
// cruza admin_estimated_votes (campo admin-only em todo o resto do sistema).
const REPORTS: { href: string; title: string; description: string; icon: LucideIcon; color: string; adminOnly?: boolean }[] = [
  {
    href: "/relatorios/liderancas",
    title: "Lideranças por bairro",
    description: "Apoiadores, demandas e atendimentos por liderança, agrupados por bairro.",
    icon: Users,
    color: "primary",
  },
  {
    href: "/relatorios/liderancas-cidade",
    title: "Lideranças por cidade",
    description: "Mesmos dados do relatório por bairro, organizados e ordenados por cidade.",
    icon: MapPin,
    color: "accent",
  },
  {
    href: "/relatorios/pessoas-atendidas",
    title: "Pessoas atendidas",
    description: "Todo apoiador com demanda ou atendimento registrado, com totais e status — filtrável por bairro e cidade.",
    icon: HeartHandshake,
    color: "supporter",
  },
  {
    href: "/relatorios/geral",
    title: "Todos os cadastros",
    description: "Lideranças e apoiadores juntos num só relatório, com filtro em cascata por cidade e bairro.",
    icon: Layers,
    color: "secondary",
  },
  {
    href: "/relatorios/votos",
    title: "Expectativa de votos",
    description: "Total geral, por cidade e por bairro — comparando o que cada liderança informa com sua avaliação como Admin Geral.",
    icon: BarChart3,
    color: "primary",
    adminOnly: true,
  },
  {
    href: "/relatorios/cadastros-local-votacao",
    title: "Cadastros por local de votação",
    description: "Quantas lideranças e apoiadores estão vinculados a cada local de votação — não é expectativa de voto, é a base já cadastrada.",
    icon: Landmark,
    color: "accent",
  },
]

const BADGE_CLASSES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  supporter: "bg-supporter/10 text-supporter",
  accent: "bg-accent/10 text-accent",
  secondary: "bg-secondary/10 text-secondary",
}

// Só os 2 relatórios do MVP (Módulo 11.1 e 11.5). Crescimento, ranking e
// bairros fracos (11.2 a 11.7) entram na v2, quando houver histórico
// suficiente para os indicadores serem confiáveis.
export default async function RelatoriosPage() {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole
  const visibleReports = REPORTS.filter((r) => !r.adminOnly || role === "admin_geral")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
        <p className="text-sm text-foreground/60">Visualize na tela, baixe em PDF ou imprima.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {visibleReports.map((r) => (
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
