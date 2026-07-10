"use client"

import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import { MESSAGE_TEMPLATE_TYPES, MESSAGE_TEMPLATE_TYPE_LABELS } from "@/types/domain"
import { createMessageTemplateAction, updateMessageTemplateAction } from "./actions"
import type { ActionState } from "@/app/login/actions"
import type { MessageTemplate } from "@/types/domain"

const initialState: ActionState = { error: null }

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {pending ? pendingLabel : label}
    </button>
  )
}

export function MessageTemplateForm({ template }: { template?: MessageTemplate }) {
  const boundAction = template
    ? updateMessageTemplateAction.bind(null, template.id)
    : createMessageTemplateAction
  const [state, formAction] = useFormState(boundAction, initialState)

  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-lg border border-black/5 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">Nome do modelo *</label>
          <input id="name" name="name" required defaultValue={template?.name}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label htmlFor="type" className="mb-1 block text-sm font-medium">Tipo *</label>
          <select id="type" name="type" required defaultValue={template?.type ?? ""}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            <option value="" disabled>Selecione...</option>
            {MESSAGE_TEMPLATE_TYPES.map((t) => <option key={t} value={t}>{MESSAGE_TEMPLATE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="subject" className="mb-1 block text-sm font-medium">Assunto (opcional)</label>
          <input id="subject" name="subject" defaultValue={template?.subject ?? ""}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="body" className="mb-1 block text-sm font-medium">Texto da mensagem *</label>
          <textarea id="body" name="body" required rows={6} defaultValue={template?.body}
            placeholder="Olá, {{nome}}! ..."
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          <p className="mt-1 text-xs text-foreground/50">
            Use <code>{"{{nome}}"}</code>, <code>{"{{demanda}}"}</code> e <code>{"{{status}}"}</code> como
            variáveis — elas são substituídas automaticamente ao enviar.
          </p>
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton
          label={template ? "Salvar alterações" : "Criar modelo"}
          pendingLabel={template ? "Salvando..." : "Criando..."}
        />
        <Link href="/mensagens" className="text-sm text-foreground/60 hover:underline">Cancelar</Link>
      </div>
    </form>
  )
}
