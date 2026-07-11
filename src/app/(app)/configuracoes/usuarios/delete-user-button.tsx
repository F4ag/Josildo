"use client"

import { useState, useTransition } from "react"
import { deleteUserAction } from "./actions"

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o acesso de ${userName}? Essa ação não pode ser desfeita — a pessoa perde o login imediatamente.`,
    )
    if (!confirmed) return

    startTransition(async () => {
      const result = await deleteUserAction(userId)
      setError(result.error)
    })
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="text-xs font-medium text-status-atrasada hover:underline disabled:opacity-50"
      >
        {isPending ? "Excluindo..." : "Excluir"}
      </button>
      {error && <p role="alert" className="max-w-[12rem] text-right text-xs text-status-atrasada">{error}</p>}
    </div>
  )
}
