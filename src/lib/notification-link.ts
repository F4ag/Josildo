// Mapeia (related_table, related_id) de uma notificação para a rota de
// detalhe correspondente. Mantido em sync com o que
// supabase/functions/daily-alerts/index.ts grava em `related_table`:
// "demands", "attendances" e "supporters" (aniversário, sempre com
// related_id null — 1 notificação agregada para todos os aniversariantes).
export function notificationHref(relatedTable: string | null, relatedId: string | null): string | null {
  if (relatedTable === "demands" && relatedId) return `/demandas/${relatedId}`
  if (relatedTable === "attendances" && relatedId) return `/atendimentos/${relatedId}`
  if (relatedTable === "supporters") return relatedId ? `/apoiadores/${relatedId}` : "/aniversariantes"
  return null
}
