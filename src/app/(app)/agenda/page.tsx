import type { Metadata } from "next"

export const metadata: Metadata = { title: "Agenda · Lidera+" }

// Módulo 13 (Agenda) não faz parte do MVP (ver docs/02-plano-mvp.md) — a
// tabela agenda_events já existe no schema, mas a tela ainda não foi
// construída. Essa página evita o 404 do link "Agenda" no menu lateral
// até o módulo entrar em produção.
export default function AgendaPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-black/5 bg-white p-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Agenda</h1>
      <p className="max-w-sm text-sm text-foreground/60">
        Esse módulo ainda não está disponível nesta versão do sistema. Em breve você vai poder agendar
        e acompanhar compromissos por aqui.
      </p>
    </div>
  )
}
