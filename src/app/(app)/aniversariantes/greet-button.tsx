"use client"

import { useTransition } from "react"
import { markGreeted } from "./actions"

export function GreetButton({
  supporterId, leaderId, alreadyGreeted,
}: {
  supporterId: string
  leaderId: string | null
  alreadyGreeted: boolean
}) {
  const [isPending, startTransition] = useTransition()

  if (alreadyGreeted) {
    return <span className="text-xs font-medium text-secondary">Cumprimentado ✓</span>
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => markGreeted(supporterId, leaderId))}
      className="text-xs font-medium text-foreground/60 hover:text-primary disabled:opacity-50"
    >
      Marcar como cumprimentado
    </button>
  )
}
