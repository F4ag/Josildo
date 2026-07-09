"use client"

import { useTransition } from "react"
import { toggleUserStatus } from "./actions"

export function StatusToggleButton({
  userId,
  status,
}: {
  userId: string
  status: "ativo" | "inativo"
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => toggleUserStatus(userId, status))}
      className="text-xs font-medium text-secondary hover:underline disabled:opacity-50"
    >
      {status === "ativo" ? "Desativar" : "Ativar"}
    </button>
  )
}
