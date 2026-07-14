import Link from "next/link"
import type { Metadata } from "next"
import { MessageSquareText } from "lucide-react"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listMessageTemplates } from "@/services/message-templates"
import {
  MESSAGE_TEMPLATE_TYPES, MESSAGE_TEMPLATE_TYPE_LABELS, type MessageTemplateType, type UserRole,
} from "@/types/domain"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/dashboard/stat-card"
import { can } from "@/lib/permissions"
import { StatusToggleButton } from "./status-toggle-button"

export const metadata: Metadata = { title: "Mensagens · Lidera+" }

type SearchParams = { tipo?: MessageTemplateType }

// Módulo 12 (Modelos de mensagem): admin_geral cria/edita/ativa-desativa;
// admin_equipe e liderança só visualizam os modelos ativos (a RLS
// mt_select_active já filtra isso — ver services/message-templates.ts).
export default async function MensagensPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const session = await getSessionUser()
  const supabase = await createClient()
  const role = session?.profile.role as UserRole

  const templates = await listMessageTemplates(supabase, { type: params.tipo })
  const canManage = can(role, "create", "message_templates")
  const ativos = templates.filter((t) => t.status === "ativo").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Mensagens</h1>
          <p className="text-sm text-foreground/60">{templates.length} modelo(s) com os filtros atuais.</p>
        </div>
        {canManage && (
          <Link href="/mensagens/novo"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Novo modelo
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total de modelos" value={templates.length} icon={MessageSquareText} tone="primary" />
        <StatCard label="Ativos" value={ativos} icon={MessageSquareText} tone="secondary" />
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
        <select name="tipo" defaultValue={params.tipo ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todo tipo</option>
          {MESSAGE_TEMPLATE_TYPES.map((t) => <option key={t} value={t}>{MESSAGE_TEMPLATE_TYPE_LABELS[t]}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          Filtrar
        </button>
      </form>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
          Nenhum modelo de mensagem encontrado.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:hidden">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-black/5 bg-white p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="font-medium text-foreground">{t.name}</span>
                  <Badge tone={t.status === "ativo" ? "verde" : "cinza"}>
                    {t.status === "ativo" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-xs text-foreground/50">{MESSAGE_TEMPLATE_TYPE_LABELS[t.type as MessageTemplateType]}</p>
                <p className="mt-1 truncate text-sm text-foreground/70">{t.body}</p>
                {canManage && (
                  <div className="mt-3 flex items-center gap-2">
                    <Link href={`/mensagens/${t.id}`}
                      className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5">
                      Editar
                    </Link>
                    <StatusToggleButton templateId={t.id} status={t.status as "ativo" | "inativo"} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Texto</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-t border-black/5">
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{t.name}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {MESSAGE_TEMPLATE_TYPE_LABELS[t.type as MessageTemplateType]}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      <p className="max-w-md truncate">{t.body}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={t.status === "ativo" ? "verde" : "cinza"}>
                        {t.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/mensagens/${t.id}`}
                            className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5">
                            Editar
                          </Link>
                          <StatusToggleButton templateId={t.id} status={t.status as "ativo" | "inativo"} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
