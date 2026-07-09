// Notificações (Módulo 10 — Alertas). As linhas são criadas pela Edge
// Function supabase/functions/daily-alerts (via service_role, ignora RLS) ou,
// no futuro, por qualquer outra rotina do sistema que precise avisar a
// equipe. Aqui só lemos/atualizamos as notificações do usuário logado — RLS
// (`nt_select_own`/`nt_update_own`) já garante que cada usuário só enxerga
// as suas próprias linhas, então os filtros `.eq("user_id", userId)` abaixo
// são redundantes com o banco, mas explícitos de propósito (documentam a
// regra e evitam depender só do RLS se um dia rodar com a service_role).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type DB = SupabaseClient<Database>

export type NotificationRow = {
  id: string
  title: string
  message: string | null
  notificationType: string | null
  relatedTable: string | null
  relatedId: string | null
  isRead: boolean
  createdAt: string
}

const RECENT_LIMIT = 10

export async function listRecentNotifications(supabase: DB, userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, notification_type, related_table, related_id, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT)
  if (error) throw new Error(`Falha ao listar notificações: ${error.message}`)

  return (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    notificationType: n.notification_type,
    relatedTable: n.related_table,
    relatedId: n.related_id,
    isRead: n.is_read,
    createdAt: n.created_at,
  }))
}

export async function countUnreadNotifications(supabase: DB, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
  if (error) throw new Error(`Falha ao contar notificações: ${error.message}`)
  return count ?? 0
}

export async function markNotificationRead(supabase: DB, id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", userId)
  if (error) throw new Error(`Falha ao marcar notificação como lida: ${error.message}`)
}

export async function markAllNotificationsRead(supabase: DB, userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false)
  if (error) throw new Error(`Falha ao marcar notificações como lidas: ${error.message}`)
}
