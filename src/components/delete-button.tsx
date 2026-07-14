"use client"

import { useFormState, useFormStatus } from "react-dom"
import type { ActionState } from "@/app/login/actions"

const initialState: ActionState = { error: null }

// "danger" (padrão) é o vermelho de sempre pra exclusão. "primary" existe
// pra outras ações que também merecem confirmação antes de disparar (ex.:
// transformar apoiador em liderança em apoiadores/[id]/page.tsx) mas não
// são destrutivas — mesmo componente, só troca a cor pra não parecer um
// botão de excluir.
const TONE_CLASSES = {
  danger: "border-status-atrasada/30 text-status-atrasada hover:bg-status-atrasada/10",
  primary: "border-primary/30 text-primary hover:bg-primary/10",
} as const

function ConfirmSubmit({
  label, confirmMessage, tone, pendingLabel,
}: { label: string; confirmMessage: string; tone: keyof typeof TONE_CLASSES; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-60 ${TONE_CLASSES[tone]}`}
    >
      {pending ? pendingLabel : label}
    </button>
  )
}

/**
 * Botão de ação com confirmação reutilizável (excluir lideranças/apoiadores,
 * transformar apoiador em liderança, ...). Pede confirmação via
 * window.confirm antes de disparar a server action — não é a barreira de
 * segurança (isso é can()/RLS), é só evitar clique acidental numa ação
 * relevante. A action deve ter assinatura
 * (id, prevState, formData) => Promise<ActionState> e já vir com o id
 * pré-preso via .bind(null, id) por quem usa este componente (mesmo padrão
 * de demandas/status-update-form.tsx).
 */
export function DeleteButton({
  action,
  label = "Excluir",
  confirmMessage = "Tem certeza que deseja excluir? Essa ação não pode ser desfeita.",
  tone = "danger",
  pendingLabel = tone === "danger" ? "Excluindo..." : "Enviando...",
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  label?: string
  confirmMessage?: string
  tone?: keyof typeof TONE_CLASSES
  pendingLabel?: string
}) {
  const [state, formAction] = useFormState(action, initialState)

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <ConfirmSubmit label={label} confirmMessage={confirmMessage} tone={tone} pendingLabel={pendingLabel} />
      {state.error && (
        <p role="alert" className="max-w-xs text-right text-xs text-status-atrasada">
          {state.error}
        </p>
      )}
    </form>
  )
}
