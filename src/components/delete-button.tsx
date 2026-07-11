"use client"

import { useFormState, useFormStatus } from "react-dom"
import type { ActionState } from "@/app/login/actions"

const initialState: ActionState = { error: null }

function ConfirmSubmit({ label, confirmMessage }: { label: string; confirmMessage: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
      className="rounded-md border border-status-atrasada/30 px-3 py-1.5 text-sm font-medium text-status-atrasada transition-opacity hover:bg-status-atrasada/10 disabled:opacity-60"
    >
      {pending ? "Excluindo..." : label}
    </button>
  )
}

/**
 * Botão de exclusão reutilizável (lideranças, apoiadores, ...). Pede
 * confirmação via window.confirm antes de disparar a server action — não é
 * a barreira de segurança (isso é can()/RLS), é só evitar clique acidental
 * num destrutivo. A action deve ter assinatura
 * (id, prevState, formData) => Promise<ActionState> e já vir com o id
 * pré-preso via .bind(null, id) por quem usa este componente (mesmo padrão
 * de demandas/status-update-form.tsx).
 */
export function DeleteButton({
  action,
  label = "Excluir",
  confirmMessage = "Tem certeza que deseja excluir? Essa ação não pode ser desfeita.",
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  label?: string
  confirmMessage?: string
}) {
  const [state, formAction] = useFormState(action, initialState)

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <ConfirmSubmit label={label} confirmMessage={confirmMessage} />
      {state.error && (
        <p role="alert" className="max-w-xs text-right text-xs text-status-atrasada">
          {state.error}
        </p>
      )}
    </form>
  )
}
