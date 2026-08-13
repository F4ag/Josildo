"use client"

import { useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import type { ActionState } from "@/app/login/actions"

const initialState: ActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/30 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "Reenviando..." : "Reenviar"}
    </button>
  )
}

/**
 * Reenvio de convite de acesso (Módulo 3) — pra quando o e-mail original
 * foi digitado errado (ou simplesmente não chegou) e a liderança já tem
 * login criado. Antes disso a única saída era excluir e recadastrar do
 * zero. Fica fechado por padrão (só o botão) pra não poluir a página de
 * detalhe com um formulário que a maioria das visitas não vai usar.
 *
 * O campo de e-mail vem preenchido com o e-mail atual mas é editável —
 * corrigir aqui e reenviar faz a Server Action atualizar o e-mail do login
 * (não só o do cadastro) antes de mandar o novo link. Ver resendInviteAction
 * em actions.ts.
 */
export function ResendInviteForm({
  action, currentEmail, hasPhone,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  currentEmail: string | null
  hasPhone: boolean
}) {
  const [state, formAction] = useFormState(action, initialState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5"
      >
        Reenviar convite de acesso
      </button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-black/10 bg-black/[0.02] p-4 sm:max-w-md">
      <div>
        <label htmlFor="resend_email" className="mb-1 block text-sm font-medium">
          E-mail do acesso
        </label>
        <input
          id="resend_email" name="resend_email" type="email" defaultValue={currentEmail ?? undefined}
          placeholder="e-mail da liderança"
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-xs text-foreground/50">
          Errado no cadastro anterior? Corrija aqui — o login é atualizado pra esse endereço antes do reenvio.
        </p>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-foreground/70">Reenviar por:</legend>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="resend_channel" value="email" defaultChecked className="h-3.5 w-3.5" />
            E-mail
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="resend_channel" value="whatsapp" disabled={!hasPhone} className="h-3.5 w-3.5" />
            WhatsApp{!hasPhone && " (sem número cadastrado)"}
          </label>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-foreground/50 hover:underline">
          Cancelar
        </button>
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-status-atrasada">{state.error}</p>
      )}
    </form>
  )
}
