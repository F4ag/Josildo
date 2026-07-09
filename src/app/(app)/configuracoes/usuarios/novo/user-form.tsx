"use client"

import { useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import { inviteUser } from "../actions"
import { USER_ROLE_LABELS } from "@/types/domain"
import type { ActionState } from "@/app/login/actions"

const initialState: ActionState = { error: null }

type LeaderOption = { id: string; name: string; neighborhood: string | null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Enviando convite..." : "Enviar convite"}
    </button>
  )
}

export function UserForm({ leadersWithoutAccount }: { leadersWithoutAccount: LeaderOption[] }) {
  const [state, formAction] = useFormState(inviteUser, initialState)
  const [role, setRole] = useState<string>("admin_equipe")

  if (state.success) {
    return (
      <div className="rounded-lg border border-black/5 bg-white p-6">
        <p className="text-sm text-foreground/80">
          Convite enviado. A pessoa vai receber um e-mail para definir a senha e acessar o
          Lidera+.
        </p>
        <Link href="/configuracoes/usuarios" className="mt-4 inline-block text-sm text-secondary hover:underline">
          Voltar para a lista de usuários
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg border border-black/5 bg-white p-6">
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm font-medium">Nome completo</label>
        <input
          id="full_name" name="full_name" required
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">E-mail</label>
        <input
          id="email" name="email" type="email" required
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium">WhatsApp (opcional)</label>
        <input
          id="phone" name="phone" placeholder="5511999999999"
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="role" className="mb-1 block text-sm font-medium">Perfil</label>
        <select
          id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="admin_equipe">{USER_ROLE_LABELS.admin_equipe}</option>
          <option value="admin_geral">{USER_ROLE_LABELS.admin_geral}</option>
          <option value="lideranca">{USER_ROLE_LABELS.lideranca}</option>
        </select>
      </div>

      {role === "lideranca" && (
        <div>
          <label htmlFor="leader_id" className="mb-1 block text-sm font-medium">
            Qual liderança este usuário representa?
          </label>
          <select
            id="leader_id" name="leader_id"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Selecione...</option>
            {leadersWithoutAccount.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name} {leader.neighborhood ? `— ${leader.neighborhood}` : ""}
              </option>
            ))}
          </select>
          {leadersWithoutAccount.length === 0 && (
            <p className="mt-1 text-xs text-foreground/50">
              Nenhuma liderança sem login vinculado. Cadastre a liderança primeiro em /liderancas.
            </p>
          )}
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-status-atrasada">{state.error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <Link href="/configuracoes/usuarios" className="text-sm text-foreground/60 hover:underline">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
