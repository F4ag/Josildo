import type { Metadata } from "next"

export const metadata: Metadata = { title: "Mensagens · Lidera+" }

// Módulo 12 (Modelos de mensagem) não faz parte do MVP (ver
// docs/02-plano-mvp.md) — hoje só existe 1 modelo usado internamente pela
// tela de Aniversariantes (mensagem de parabéns). Essa página evita o 404
// do link "Mensagens" no menu lateral até o módulo entrar em produção.
export default function MensagensPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-black/5 bg-white p-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Mensagens</h1>
      <p className="max-w-sm text-sm text-foreground/60">
        Esse módulo ainda não está disponível nesta versão do sistema. Em breve você vai poder criar e
        gerenciar modelos de mensagem por aqui.
      </p>
    </div>
  )
}
