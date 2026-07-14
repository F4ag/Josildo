import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { clsx } from "clsx"

// Cada card usa um tom sólido da paleta da marca (ver tailwind.config.ts)
// em vez do retângulo branco anterior — pedido explícito de deixar o topo
// do Dashboard com cara de "cards de app" (referência: telas de apps de
// estatísticas de saúde), mas sem sair da identidade visual do Lidera+.
export type StatCardTone = "primary" | "supporter" | "orange" | "secondary" | "accent" | "danger"

const TONE_CLASSES: Record<StatCardTone, string> = {
  primary: "bg-primary text-primary-foreground",
  supporter: "bg-supporter text-supporter-foreground",
  // "laranja" já existe como token de status (status-em_andamento) — reaproveitado
  // aqui em vez de criar mais uma cor só para este card.
  orange: "bg-status-em_andamento text-white",
  secondary: "bg-secondary text-secondary-foreground",
  // Dourado/accent é claro demais para texto branco (mesmo motivo do Badge
  // "amarelo" em ui/badge.tsx) — usa o texto grafite escuro já definido em
  // accent.foreground no tailwind.config.ts.
  accent: "bg-accent text-accent-foreground",
  // Pra métricas de conotação negativa (atrasadas, inativas, não atendidas)
  // — reaproveita o vermelho de status.atrasada, já usado no resto do app
  // pra esse mesmo significado, em vez de inventar mais um tom.
  danger: "bg-status-atrasada text-white",
}

// Mini-gráfico de linha (14 dias) desenhado à mão em SVG em vez de puxar o
// Recharts pra dentro do card — é só uma textura decorativa (não tem eixo,
// tooltip nem legenda), então um polyline simples já resolve e mantém o
// StatCard leve. Normaliza os valores pro viewBox de 100x28; se todo mundo
// tiver o mesmo valor (inclusive todos 0), desenha uma linha reta no meio
// pra não dividir por zero.
function Sparkline({ trend }: { trend: number[] }) {
  const max = Math.max(...trend)
  const min = Math.min(...trend)
  const range = max - min
  const points = trend
    .map((value, i) => {
      const x = (i / (trend.length - 1)) * 100
      const y = range === 0 ? 14 : 28 - ((value - min) / range) * 28
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-2 h-6 w-full opacity-80">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatCard({
  label, value, href, icon: Icon, tone = "primary", trend,
}: {
  label: string
  value: number | string
  href?: string
  icon: LucideIcon
  tone?: StatCardTone
  /** Série diária dos últimos 14 dias (mais antigo primeiro), vinda de
   * getDashboardTrends em services/dashboard.ts. Opcional — cards sem
   * série histórica clara (ex.: nenhum ainda) simplesmente não mostram
   * o sparkline. */
  trend?: number[]
}) {
  const content = (
    <div
      className={clsx(
        "flex h-full flex-col rounded-2xl p-4 shadow-sm transition-transform hover:-translate-y-0.5",
        TONE_CLASSES[tone],
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-2xl font-semibold leading-tight">{value}</p>
      <p className="mt-0.5 text-xs opacity-90">{label}</p>
      {trend && trend.length > 1 && <Sparkline trend={trend} />}
    </div>
  )

  return href ? (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  )
}
