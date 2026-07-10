import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { clsx } from "clsx"

// Cada card usa um tom sólido da paleta da marca (ver tailwind.config.ts)
// em vez do retângulo branco anterior — pedido explícito de deixar o topo
// do Dashboard com cara de "cards de app" (referência: telas de apps de
// estatísticas de saúde), mas sem sair da identidade visual do Lidera+.
export type StatCardTone = "primary" | "supporter" | "orange" | "secondary" | "accent"

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
}

export function StatCard({
  label, value, href, icon: Icon, tone = "primary",
}: {
  label: string
  value: number | string
  href?: string
  icon: LucideIcon
  tone?: StatCardTone
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
