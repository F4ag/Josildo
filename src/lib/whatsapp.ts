// Integração WhatsApp do MVP (Módulo 12): link wa.me, sem API paga.
// v3 do prompt master troca isto pela WhatsApp Business API — quando isso
// acontecer, só esta função muda; nenhum componente que a chama precisa mudar.

/** Mantém só dígitos e garante o código do país (55) na frente. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("55")) return digits
  return `55${digits}`
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizePhone(phone)
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

/** Substitui {{variavel}} no corpo de um message_template pelos valores dados. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => vars[key] ?? "")
}
