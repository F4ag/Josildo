import { clsx } from "clsx"

export type BadgeTone = "verde" | "amarelo" | "vermelho" | "azul" | "cinza" | "laranja"

const TONE_CLASSES: Record<BadgeTone, string> = {
  verde: "bg-secondary/10 text-secondary",
  amarelo: "bg-accent/20 text-accent-foreground",
  vermelho: "bg-status-atrasada/10 text-status-atrasada",
  azul: "bg-primary/10 text-primary",
  cinza: "bg-black/5 text-foreground/70",
  laranja: "bg-status-em_andamento/10 text-status-em_andamento",
}

/** Badge de status genérico. `tone` mapeia para as cores do §8/§11 do prompt master. */
export function Badge({ children, tone = "cinza" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  )
}
