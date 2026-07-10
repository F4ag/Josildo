"use client"

import { useTransition } from "react"
import { toggleMessageTemplateStatusAction } from "./actions"

export function StatusToggleButton({
  templateId,
  status,
}: {
  templateId: string
  status: "ativo" | "inativo"
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => toggleMessageTemplateStatusAction(templateId))}
      className="text-xs font-medium text-secondary hover:underline disabled:opacity-50"
    >
      {status === "ativo" ? "Desativar" : "Ativar"}
    </button>
  )
}
