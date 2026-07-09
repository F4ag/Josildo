"use client"

import { MessageCircle } from "lucide-react"
import { buildWhatsAppLink } from "@/lib/whatsapp"

type WhatsAppButtonProps = {
  phone: string | null
  message?: string
  label?: string
  /**
   * Módulo 15 (LGPD): passe `supporter.consent_whatsapp` sempre que o
   * contato for um APOIADOR — a pessoa pode ter consentido em ser
   * cadastrada (`consent_registration`) sem ter autorizado contato por
   * WhatsApp especificamente, e essas são colunas distintas em
   * `supporters` (ver supabase/schema.sql). Quando `false`, o botão fica
   * desabilitado em vez de escondido, pra deixar claro que existe uma
   * restrição de consentimento (e não que a pessoa não tem WhatsApp).
   * Deixe `undefined` só para contatos que NÃO são regidos por esse
   * consentimento (lideranças/equipe — contato profissional, não dado
   * pessoal de eleitor).
   */
  consentWhatsapp?: boolean
}

/**
 * Botão de WhatsApp reutilizável (Módulo 12). Abre wa.me em nova aba com a
 * mensagem pré-preenchida — não registra a interação sozinho: quem chama
 * este componente numa tela com contexto (liderança, apoiador, demanda)
 * deve gravar em `interactions` no clique, se aplicável.
 */
export function WhatsAppButton({ phone, message = "", label = "WhatsApp", consentWhatsapp }: WhatsAppButtonProps) {
  if (!phone) return null

  if (consentWhatsapp === false) {
    return (
      <span
        title="Apoiador não autorizou contato via WhatsApp (Módulo 15 — LGPD)"
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium text-foreground/40"
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        Sem consentimento
      </span>
    )
  }

  return (
    <a
      href={buildWhatsAppLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-secondary/30 px-3 py-1.5 text-sm font-medium text-secondary hover:bg-secondary/10"
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      {label}
    </a>
  )
}
